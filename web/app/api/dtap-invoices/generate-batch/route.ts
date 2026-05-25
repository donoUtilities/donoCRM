import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { getToken } from "next-auth/jwt";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { generateInvoicePdf, deleteDoc, createWriteCounter } from "@/lib/google";
import { createLimiter } from "@/lib/concurrency";
import { env } from "@/lib/env";
import {
  buildInvoicePayload,
  extractDriveFileId,
  type InvoiceBundle,
} from "@/lib/invoice-payload";

/* ── Route segment config ── */
// Note: maxDuration only applies on Vercel deployments
export const dynamic = "force-dynamic";

const DB_NAME = "DonoUtilities";

/* ── SSE helpers ── */

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/* ── Main handler ── */

export async function POST(request: NextRequest) {
  // Auth
  const session = await auth();
  if (!session) {
    return new Response(
      JSON.stringify({ error: "Not authenticated. Please log out and log in again to grant Google Docs/Drive permissions." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Read access token from the JWT (never exposed to the client)
  const jwtToken = await getToken({ req: request, secret: process.env.AUTH_SECRET });
  const accessToken = jwtToken?.accessToken as string | undefined;

  if (!accessToken) {
    return new Response(
      JSON.stringify({ error: "Not authenticated. Please log out and log in again to grant Google Docs/Drive permissions." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  let invoiceIds: string[];
  try {
    const body = await request.json();
    invoiceIds = body.invoiceIds;
    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      throw new Error("invoiceIds must be a non-empty array");
    }
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message || "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const templateAdmin = env.GOOGLE_DOC_TEMPLATE_ADMIN;
  const templateTeam = env.GOOGLE_DOC_TEMPLATE_TEAM;
  const folderId = env.GOOGLE_DRIVE_FOLDER_ID;

  // Stream SSE response
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    cancel() {
      // Client disconnected (navigation, AbortController, etc.)
      closed = true;
    },
    async start(controller) {
      /** Safe emit — silently drops events after client disconnect */
      function emit(data: Record<string, unknown>) {
        if (closed) return;
        try { controller.enqueue(encoder.encode(sseEvent(data))); }
        catch { closed = true; }
      }

      // ── Heartbeat: keep connection alive through proxies ──
      const heartbeat = setInterval(() => {
        if (closed) { clearInterval(heartbeat); return; }
        try { controller.enqueue(encoder.encode(`: ping\n\n`)); }
        catch { closed = true; clearInterval(heartbeat); }
      }, 5000);

      try {
        /* ── 1. Batch Mongo lookups ── */
        const client = await clientPromise;
        const db = client.db(DB_NAME);

        const objectIds = invoiceIds.map(id => new ObjectId(id));
        const invoices = await db
          .collection("DonoUtilities_DtapInvoices")
          .find({ _id: { $in: objectIds } })
          .toArray();

        // Build lookup map for invoices
        const invoiceMap = new Map(invoices.map(inv => [inv._id.toString(), inv]));

        // Collect all referenced IDs across the batch
        const dtapIdSet = new Set<string>();
        const allDtapItemIds: ObjectId[] = [];

        for (const inv of invoices) {
          if (inv.dtapId) dtapIdSet.add(inv.dtapId.toString());
          if (Array.isArray(inv.dtapItemsIds)) {
            for (const id of inv.dtapItemsIds) {
              allDtapItemIds.push(new ObjectId(id.toString()));
            }
          }
        }

        // Fetch DTAPs
        const dtapIds = [...dtapIdSet].map(id => new ObjectId(id));
        const dtaps = dtapIds.length
          ? await db.collection("DonoUtilities_Dtap").find({ _id: { $in: dtapIds } }).toArray()
          : [];
        const dtapMap = new Map(dtaps.map(d => [d._id.toString(), d]));

        // Collect team and wireCenter IDs from DTAPs
        const teamIdSet = new Set<string>();
        const wireCenterIdSet = new Set<string>();
        for (const d of dtaps) {
          if (d.teamId) teamIdSet.add(d.teamId.toString());
          if (d.wireCenterId) wireCenterIdSet.add(d.wireCenterId.toString());
        }

        // Fetch Teams
        const teamIds = [...teamIdSet].map(id => new ObjectId(id));
        const teams = teamIds.length
          ? await db.collection("DonoUtilities_Teams").find({ _id: { $in: teamIds } }).toArray()
          : [];
        const teamMap = new Map(teams.map(t => [t._id.toString(), t]));

        // Fetch Wire Centers
        const wcIds = [...wireCenterIdSet].map(id => new ObjectId(id));
        const wireCenters = wcIds.length
          ? await db.collection("DonoUtilities_WireCenter").find({ _id: { $in: wcIds } }).toArray()
          : [];
        const wcMap = new Map(wireCenters.map(w => [w._id.toString(), w]));

        // Fetch ALL DtapRecords referenced by any invoice in the batch
        const dtapRecords = allDtapItemIds.length
          ? await db.collection("DonoUtilities_DtapRecords").find({ _id: { $in: allDtapItemIds } }).toArray()
          : [];
        const recordMap = new Map(dtapRecords.map(r => [r._id.toString(), r]));

        // Fetch DtapPrices exactly ONCE for the whole batch (stable order)
        const pricesEntries = await db.collection("DonoUtilities_DtapPrices").find({}).sort({ _id: 1 }).toArray();

        /* ── 2. Process invoices with concurrency limiter ── */
        const limit = createLimiter();
        let succeeded = 0;
        let failed = 0;

        const concurrency = Number(process.env.INVOICE_BATCH_CONCURRENCY) || 4;
        console.log(`[batch] start (${invoiceIds.length} invoices, concurrency=${concurrency})`);
        const batchStart = Date.now();

        const tasks = invoiceIds.map(invoiceId =>
          limit(async () => {
            // ── Emit "started" event immediately so the client sees spinners ──
            emit({ invoiceId, status: "started" });

            const invoiceStart = Date.now();
            const writeCounter = createWriteCounter();

            try {
              const invoice = invoiceMap.get(invoiceId);
              if (!invoice) {
                emit({ invoiceId, status: "error", error: "Invoice not found" });
                failed++;
                console.log(`[batch] inv ${invoiceId} not found`);
                return;
              }

              const invoiceNum = invoice.invoiceNumber || invoiceId;
              console.log(`[batch] inv ${invoiceNum} started`);

              // Resolve related entities from pre-fetched maps
              const dtap = invoice.dtapId ? dtapMap.get(invoice.dtapId.toString()) ?? null : null;
              const team = dtap?.teamId ? teamMap.get(dtap.teamId.toString()) ?? null : null;
              const wireCenter = dtap?.wireCenterId ? wcMap.get(dtap.wireCenterId.toString()) ?? null : null;

              // Resolve records for this invoice
              const invoiceRecords = Array.isArray(invoice.dtapItemsIds)
                ? invoice.dtapItemsIds
                    .map((id: { toString(): string }) => recordMap.get(id.toString()))
                    .filter(Boolean) as Record<string, unknown>[]
                : [];

              // Build payload
              const bundle: InvoiceBundle = {
                invoice: invoice as Record<string, unknown>,
                dtap: dtap as Record<string, unknown> | null,
                team: team as Record<string, unknown> | null,
                wireCenter: wireCenter as Record<string, unknown> | null,
                records: invoiceRecords,
                pricesEntries: pricesEntries as Record<string, unknown>[],
              };

              const payload = buildInvoicePayload(bundle);

              // Delete old PDFs (best-effort)
              const oldAdminFileId = extractDriveFileId(invoice.adminInvoice as string);
              const oldTeamFileId = extractDriveFileId(invoice.teamInvoice as string);
              await Promise.allSettled([
                oldAdminFileId ? deleteDoc(accessToken, oldAdminFileId) : Promise.resolve(),
                oldTeamFileId ? deleteDoc(accessToken, oldTeamFileId) : Promise.resolve(),
              ]);

              // Generate admin + team PDFs in parallel
              const [adminUrl, teamUrl] = await Promise.all([
                generateInvoicePdf(
                  accessToken,
                  templateAdmin,
                  payload.commonReplacements,
                  `${payload.dtapLabel}_Admin_Invoice_${payload.invoiceNum}.pdf`,
                  folderId,
                  [payload.recordsTableDef, payload.adminPriceTableDef],
                  [payload.picturesGrid],
                  writeCounter
                ),
                generateInvoicePdf(
                  accessToken,
                  templateTeam,
                  payload.commonReplacements,
                  `${payload.dtapLabel}_Team_Invoice_${payload.invoiceNum}.pdf`,
                  folderId,
                  [payload.recordsTableDef, payload.teamPriceTableDef],
                  [payload.picturesGrid],
                  writeCounter
                ),
              ]);

              // Store URLs back in Mongo
              await db.collection("DonoUtilities_DtapInvoices").updateOne(
                { _id: new ObjectId(invoiceId) },
                {
                  $set: {
                    adminInvoice: adminUrl,
                    teamInvoice: teamUrl,
                    invoiceGeneratedAt: new Date().toISOString(),
                    invoiceGeneratedBy: session.user?.email || "",
                  },
                }
              );

              const elapsed = ((Date.now() - invoiceStart) / 1000).toFixed(1);
              console.log(`[batch] inv ${invoiceNum} done in ${elapsed}s (${writeCounter.writes} writes)`);

              emit({ invoiceId, status: "ok", adminInvoice: adminUrl, teamInvoice: teamUrl });
              succeeded++;
            } catch (error) {
              const message = error instanceof Error ? error.message : "Unknown error";
              const elapsed = ((Date.now() - invoiceStart) / 1000).toFixed(1);
              console.error(`[batch] inv ${invoiceId} FAILED in ${elapsed}s (${writeCounter.writes} writes):`, error);
              emit({ invoiceId, status: "error", error: message });
              failed++;
            }
          })
        );

        await Promise.all(tasks);

        const totalElapsed = ((Date.now() - batchStart) / 1000).toFixed(1);
        console.log(`[batch] complete: ${succeeded} ok, ${failed} failed, ${totalElapsed}s total`);

        // Final summary event
        emit({ done: true, total: invoiceIds.length, succeeded, failed });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Batch generation fatal error:", error);
        emit({ done: true, total: invoiceIds.length, succeeded: 0, failed: invoiceIds.length, error: message });
      } finally {
        clearInterval(heartbeat);
        if (!closed) { try { controller.close(); } catch { /* already closed */ } }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
