import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getToken } from "next-auth/jwt";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { generateInvoicePdf, deleteDoc } from "@/lib/google";
import { env } from "@/lib/env";
import {
  buildInvoicePayload,
  extractDriveFileId,
  type InvoiceBundle,
} from "@/lib/invoice-payload";

const DB_NAME = "DonoUtilities";

/* ── Main handler ── */

export async function POST(request: NextRequest) {
  try {
    // Get authenticated session with Google access token
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated. Please log out and log in again to grant Google Docs/Drive permissions." },
        { status: 401 }
      );
    }

    // Read access token from the JWT (never exposed to the client)
    const token = await getToken({ req: request, secret: process.env.AUTH_SECRET });
    const accessToken = token?.accessToken as string | undefined;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Not authenticated. Please log out and log in again to grant Google Docs/Drive permissions." },
        { status: 401 }
      );
    }

    const { invoiceId } = await request.json();
    if (!invoiceId) {
      return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Fetch the invoice
    const invoice = await db
      .collection("DonoUtilities_DtapInvoices")
      .findOne({ _id: new ObjectId(invoiceId) });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Fetch related DTAP (parent feeder)
    const dtap = invoice.dtapId
      ? await db.collection("DonoUtilities_Dtap").findOne({ _id: new ObjectId(invoice.dtapId.toString()) })
      : null;

    // Resolve team and wire center names
    const team = dtap?.teamId
      ? await db.collection("DonoUtilities_Teams").findOne({ _id: new ObjectId(dtap.teamId.toString()) })
      : null;
    const wireCenter = dtap?.wireCenterId
      ? await db.collection("DonoUtilities_WireCenter").findOne({ _id: new ObjectId(dtap.wireCenterId.toString()) })
      : null;

    // Fetch all DTAP records (items) for this invoice
    const dtapItemsIds = Array.isArray(invoice.dtapItemsIds)
      ? invoice.dtapItemsIds.map((id: { toString(): string }) => new ObjectId(id.toString()))
      : [];

    const records = dtapItemsIds.length
      ? await db
          .collection("DonoUtilities_DtapRecords")
          .find({ _id: { $in: dtapItemsIds } })
          .toArray()
      : [];

    // Fetch DtapPrices entries in stable order
    const pricesEntries = await db.collection("DonoUtilities_DtapPrices").find({}).sort({ _id: 1 }).toArray();

    // Build payload using shared helpers
    const bundle: InvoiceBundle = {
      invoice: invoice as Record<string, unknown>,
      dtap: dtap as Record<string, unknown> | null,
      team: team as Record<string, unknown> | null,
      wireCenter: wireCenter as Record<string, unknown> | null,
      records: records as Record<string, unknown>[],
      pricesEntries: pricesEntries as Record<string, unknown>[],
    };

    const payload = buildInvoicePayload(bundle);

    const templateAdmin = env.GOOGLE_DOC_TEMPLATE_ADMIN;
    const templateTeam = env.GOOGLE_DOC_TEMPLATE_TEAM;
    const folderId = env.GOOGLE_DRIVE_FOLDER_ID;

    // Delete old PDF files from Drive if regenerating
    const oldAdminFileId = extractDriveFileId(invoice.adminInvoice as string);
    const oldTeamFileId = extractDriveFileId(invoice.teamInvoice as string);

    // Best-effort delete — don't fail the whole operation if cleanup fails
    await Promise.allSettled([
      oldAdminFileId ? deleteDoc(accessToken, oldAdminFileId) : Promise.resolve(),
      oldTeamFileId ? deleteDoc(accessToken, oldTeamFileId) : Promise.resolve(),
    ]);

    // Generate admin + team PDFs in parallel (writeQueue removed — safe on different docIds)
    const [adminUrl, teamUrl] = await Promise.all([
      generateInvoicePdf(
        accessToken,
        templateAdmin,
        payload.commonReplacements,
        `${payload.dtapLabel}_Admin_Invoice_${payload.invoiceNum}.pdf`,
        folderId,
        [payload.recordsTableDef, payload.adminPriceTableDef],
        [payload.picturesGrid]
      ),
      generateInvoicePdf(
        accessToken,
        templateTeam,
        payload.commonReplacements,
        `${payload.dtapLabel}_Team_Invoice_${payload.invoiceNum}.pdf`,
        folderId,
        [payload.recordsTableDef, payload.teamPriceTableDef],
        [payload.picturesGrid]
      ),
    ]);

    // Store URLs back in the invoice document
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

    return NextResponse.json({
      adminInvoice: adminUrl,
      teamInvoice: teamUrl,
    });
  } catch (error) {
    console.error("Invoice generation failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Invoice generation failed: ${message}` }, { status: 500 });
  }
}
