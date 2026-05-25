import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import clientPromise from "@/lib/mongodb";
import { generateInvoicePdf, deleteDoc } from "@/lib/google";
import type { TableDef, PicturesGridDef } from "@/lib/google";

const DB_NAME = "DonoUtilities";

/* ── Price-table helpers ── */

interface PriceRow {
  [key: string]: string;
  description: string;
  printLoc: string;
  qty: string;
  rate: string;
  amount: string;
}

// Map DtapPrices category+type → single DtapRecord field + price field
// category = Aerial | Pulling
// type = Primary | Additional
const FIELD_MAP: Record<string, Record<string, { field: string; adminPrice: string; teamPrice: string }>> = {
  Aerial: {
    Primary:    { field: "aerialPrimary",      adminPrice: "aerialPrimaryPriceAdmin",      teamPrice: "aerialPrimaryPriceTeam" },
    Additional: { field: "aerialAdditional",   adminPrice: "aerialAdditionalPriceAdmin",   teamPrice: "aerialAdditionalPriceTeam" },
  },
  Pulling: {
    Primary:    { field: "undergroundPrimary",  adminPrice: "ugPrimaryPriceAdmin",          teamPrice: "ugPrimaryPriceTeam" },
    Additional: { field: "undergroundAdditional", adminPrice: "ugAdditionalPriceAdmin",     teamPrice: "ugAdditionalPriceTeam" },
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPriceRows(records: any[], pricesEntries: any[], variant: "admin" | "team"): PriceRow[] {
  const rows: PriceRow[] = [];

  for (const price of pricesEntries) {
    const jf = Number(price.jumperFootage) || 0;
    const type = (price.type || "").trim();           // Primary | Additional | ""
    const category = (price.category || "").trim();   // Aerial | Pulling | ""
    const desc = price.itemDescription || "";

    // ── Footage-based rows ──
    const mapping = FIELD_MAP[category]?.[type];
    if (mapping && jf > 0) {
      const subset = records.filter(r => Number(r.jumperFootage) === jf);
      if (!subset.length) continue;

      const sumFootage = subset.reduce((acc, r) => acc + (Number(r[mapping.field]) || 0), 0);
      if (sumFootage <= 0) continue;

      // QTY = SUM(footage) / jumperFootage  (NOT /1000)
      const qty = sumFootage / jf;
      const priceField = variant === "admin" ? mapping.adminPrice : mapping.teamPrice;
      const rate = Number(subset.find(r => Number(r[priceField]) > 0)?.[priceField]) || 0;

      // Amount = SUM(footage_i * rate_i / jumperFootage) per record
      const amount = subset.reduce((acc, r) => {
        const footage = Number(r[mapping.field]) || 0;
        const recordRate = Number(r[priceField]) || 0;
        return acc + (footage * recordRate) / jf;
      }, 0);

      rows.push({
        description: desc,
        printLoc: "",
        qty: qty % 1 === 0 ? String(qty) : qty.toFixed(2),
        rate: fmtCurrency(rate),
        amount: fmtCurrency(amount),
      });
      continue;
    }

    // ── Placed / Tested rows (empty type & category — detect from description) ──
    if (!type && !jf) {
      const descLower = desc.toLowerCase();

      if (descLower.includes("place")) {
        // Admin: rate & amount from placedSalePrice; Team: from placedPrice
        const rateField = variant === "admin" ? "placedSalePrice" : "placedPrice";
        const placed = records.filter(r => Number(r[rateField]) > 0);
        if (placed.length <= 0) continue;

        const rate = Number(placed[0]?.[rateField]) || 0;
        const amount = placed.reduce((acc, r) => acc + (Number(r[rateField]) || 0), 0);

        rows.push({
          description: desc,
          printLoc: "",
          qty: String(placed.length),
          rate: fmtCurrency(rate),
          amount: fmtCurrency(amount),
        });
        continue;
      }

      if (descLower.includes("test")) {
        // Admin: rate & amount from testedSalePrice; Team: from testedPrice
        const rateField = variant === "admin" ? "testedSalePrice" : "testedPrice";
        const tested = records.filter(r => Number(r[rateField]) > 0);
        if (tested.length <= 0) continue;

        const rate = Number(tested[0]?.[rateField]) || 0;
        const amount = tested.reduce((acc, r) => acc + (Number(r[rateField]) || 0), 0);

        rows.push({
          description: desc,
          printLoc: "",
          qty: String(tested.length),
          rate: fmtCurrency(rate),
          amount: fmtCurrency(amount),
        });
      }
    }
  }

  return rows;
}

const currencyFmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function fmtCurrency(v: number): string {
  if (!v) return "";
  return currencyFmt.format(v) + " $";
}

/* ── Main handler ── */

export async function POST(request: NextRequest) {
  try {
    // Get authenticated session with Google access token
    const session = await auth();
    const accessToken = session?.accessToken;

    if (!session || !accessToken) {
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
    const { ObjectId } = await import("mongodb");
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

    // Fetch DtapPrices entries (in natural DB order)
    const pricesEntries = await db.collection("DonoUtilities_DtapPrices").find({}).toArray();

    // Header-level replacements (non-table fields)
    const commonReplacements: Record<string, string> = {
      invoiceNumber: invoice.invoiceNumber || "",
      date: (() => {
        if (!invoice.date) return "";
        const d = new Date(invoice.date);
        return isNaN(d.getTime()) ? invoice.date : `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
      })(),
      week: invoice.week || "",
      dtapName: dtap?.dtap || "",
      teamName: team?.team || team?.name || "",
      wireCenterName: wireCenter?.wireCenter || wireCenter?.name || "",
      totalRecords: String(records.length),
      adminInvoiceTotal: invoice.adminInvoiceTotal != null
        ? "$" + Number(invoice.adminInvoiceTotal).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "",
      teamInvoiceTotal: invoice.teamInvoiceTotal != null
        ? "$" + Number(invoice.teamInvoiceTotal).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "",
    };

    // Helpers for formatting
    const fmtDate = (v: string | undefined): string => {
      if (!v) return "";
      const d = new Date(v);
      if (isNaN(d.getTime())) return v;
      return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    };
    const fmtNum = (v: number | string | undefined | null): string => {
      if (v == null || v === "") return "";
      const n = typeof v === "string" ? parseFloat(v) : v;
      if (isNaN(n)) return String(v);
      return n % 1 === 0
        ? n.toLocaleString("en-US")
        : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // ── Records table (shared between admin & team) ──
    const recordsTableDef: TableDef = {
      marker: "recordsTable",
      columns: [
        { key: "terminalName", label: "Terminal Name", widthPt: 120 },
        { key: "jumperFootage", label: "Jumper Footage" },
        { key: "aerialPrimary", label: "Aerial Primary" },
        { key: "aerialAdditional", label: "Aerial Additional" },
        { key: "undergroundPrimary", label: "UG Primary" },
        { key: "undergroundAdditional", label: "UG Additional" },
        { key: "terminalPlaced", label: "Terminal Placed" },
        { key: "terminalPlacedDate", label: "Terminal Placed" },
        { key: "terminalTestedDate", label: "Terminal Tested" },
      ],
      records: records.map((r) => ({
        terminalName: r.terminalName || "",
        jumperFootage: fmtNum(r.jumperFootage),
        aerialPrimary: fmtNum(r.aerialPrimary),
        aerialAdditional: fmtNum(r.aerialAdditional),
        undergroundPrimary: fmtNum(r.undergroundPrimary),
        undergroundAdditional: fmtNum(r.undergroundAdditional),
        terminalPlaced: r.terminalPlaced === true ? "✓" : "",
        terminalPlacedDate: fmtDate(r.terminalPlacedDate),
        terminalTestedDate: fmtDate(r.terminalTestedDate),
      })),
    };

    // ── Price table columns ──
    const priceColumns = [
      { key: "description", label: "Description", widthPt: 250 },
      { key: "printLoc", label: "Print / Loc" },
      { key: "qty", label: "Initial QTY" },
      { key: "rate", label: "Initial Rate" },
      { key: "amount", label: "Initial Amount" },
    ];

    // ── Build admin & team price rows (order follows DtapPrices) ──
    const adminPriceRows = buildPriceRows(records, pricesEntries, "admin");
    const teamPriceRows = buildPriceRows(records, pricesEntries, "team");

    const adminPriceTableDef: TableDef = {
      marker: "adminPriceTable",
      columns: priceColumns,
      records: adminPriceRows,
    };

    const teamPriceTableDef: TableDef = {
      marker: "teamPriceTable",
      columns: priceColumns,
      records: teamPriceRows,
    };

    const templateAdmin = process.env.GOOGLE_DOC_TEMPLATE_ADMIN!;
    const templateTeam = process.env.GOOGLE_DOC_TEMPLATE_TEAM!;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;

    const invoiceNum = invoice.invoiceNumber || invoiceId;
    const dtapLabel = dtap?.dtap || "DTAP";

    // Delete old PDF files from Drive if regenerating
    const extractDriveFileId = (url: string | undefined): string | null => {
      if (!url) return null;
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)\//);
      return match ? match[1] : null;
    };

    const oldAdminFileId = extractDriveFileId(invoice.adminInvoice);
    const oldTeamFileId = extractDriveFileId(invoice.teamInvoice);

    // Best-effort delete — don't fail the whole operation if cleanup fails
    await Promise.allSettled([
      oldAdminFileId ? deleteDoc(accessToken, oldAdminFileId) : Promise.resolve(),
      oldTeamFileId ? deleteDoc(accessToken, oldTeamFileId) : Promise.resolve(),
    ]);

    // ── Collect record pictures ──
    const pictureUrls: string[] = [];
    for (const r of records) {
      if (r.terminalPlacedPicture) pictureUrls.push(r.terminalPlacedPicture);
      if (r.terminalTestedPicture) pictureUrls.push(r.terminalTestedPicture);
    }

    const picturesGrid: PicturesGridDef = {
      marker: "dtapRecordPictures",
      title: "PICTURES",
      imageUrls: pictureUrls,
    };

    // Generate PDFs sequentially to stay within Docs API quota (60 writes/min)
    const adminUrl = await generateInvoicePdf(
      accessToken,
      templateAdmin,
      commonReplacements,
      `${dtapLabel}_Admin_Invoice_${invoiceNum}.pdf`,
      folderId,
      [recordsTableDef, adminPriceTableDef],
      [picturesGrid]
    );
    const teamUrl = await generateInvoicePdf(
      accessToken,
      templateTeam,
      commonReplacements,
      `${dtapLabel}_Team_Invoice_${invoiceNum}.pdf`,
      folderId,
      [recordsTableDef, teamPriceTableDef],
      [picturesGrid]
    );

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

