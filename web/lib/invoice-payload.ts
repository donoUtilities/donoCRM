/**
 * Shared helpers for building invoice PDF payloads.
 * Extracted from the single-invoice generate route so both the
 * single and batch endpoints use the same logic.
 */

import type { TableDef, PicturesGridDef } from "@/lib/google";

/* ── Types ── */

export interface PriceRow {
  [key: string]: string;
  description: string;
  printLoc: string;
  qty: string;
  rate: string;
  amount: string;
}

export interface InvoiceBundle {
  invoice: Record<string, unknown>;
  dtap: Record<string, unknown> | null;
  team: Record<string, unknown> | null;
  wireCenter: Record<string, unknown> | null;
  records: Record<string, unknown>[];
  pricesEntries: Record<string, unknown>[];
}

export interface InvoicePayload {
  commonReplacements: Record<string, string>;
  recordsTableDef: TableDef;
  adminPriceTableDef: TableDef;
  teamPriceTableDef: TableDef;
  picturesGrid: PicturesGridDef;
  invoiceNum: string;
  dtapLabel: string;
}

/* ── Constants ── */

// Map DtapPrices category+type → single DtapRecord field + price field
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

const currencyFmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── Formatting helpers ── */

export function fmtCurrency(v: number): string {
  if (!v) return "";
  return currencyFmt.format(v) + " $";
}

export function fmtDate(v: string | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

export function fmtNum(v: number | string | undefined | null): string {
  if (v == null || v === "") return "";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return String(v);
  return n % 1 === 0
    ? n.toLocaleString("en-US")
    : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ── Price rows builder ── */

export function buildPriceRows(
  records: Record<string, unknown>[],
  pricesEntries: Record<string, unknown>[],
  variant: "admin" | "team"
): PriceRow[] {
  const rows: PriceRow[] = [];

  for (const price of pricesEntries) {
    const jf = Number(price.jumperFootage) || 0;
    const type = (String(price.type || "")).trim();
    const category = (String(price.category || "")).trim();
    const desc = String(price.itemDescription || "");

    // ── Footage-based rows ──
    const mapping = FIELD_MAP[category]?.[type];
    if (mapping && jf > 0) {
      const subset = records.filter(r => Number(r.jumperFootage) === jf);
      if (!subset.length) continue;

      const sumFootage = subset.reduce((acc, r) => acc + (Number(r[mapping.field]) || 0), 0);
      if (sumFootage <= 0) continue;

      const qty = sumFootage / jf;
      const priceField = variant === "admin" ? mapping.adminPrice : mapping.teamPrice;
      const rate = Number(subset.find(r => Number(r[priceField]) > 0)?.[priceField]) || 0;

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

    // ── Placed / Tested rows ──
    if (!type && !jf) {
      const descLower = desc.toLowerCase();

      if (descLower.includes("place")) {
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

/* ── Payload builders ── */

export function buildCommonReplacements(
  invoice: Record<string, unknown>,
  dtap: Record<string, unknown> | null,
  team: Record<string, unknown> | null,
  wireCenter: Record<string, unknown> | null,
  records: Record<string, unknown>[]
): Record<string, string> {
  return {
    invoiceNumber: String(invoice.invoiceNumber || ""),
    date: (() => {
      if (!invoice.date) return "";
      const d = new Date(invoice.date as string);
      return isNaN(d.getTime()) ? String(invoice.date) : `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    })(),
    week: String(invoice.week || ""),
    dtapName: String(dtap?.dtap || ""),
    teamName: String(team?.team || team?.name || ""),
    wireCenterName: String(wireCenter?.wireCenter || wireCenter?.name || ""),
    totalRecords: String(records.length),
    adminInvoiceTotal: invoice.adminInvoiceTotal != null
      ? "$" + Number(invoice.adminInvoiceTotal).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "",
    teamInvoiceTotal: invoice.teamInvoiceTotal != null
      ? "$" + Number(invoice.teamInvoiceTotal).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "",
  };
}

export function buildRecordsTableDef(records: Record<string, unknown>[]): TableDef {
  return {
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
      terminalName: String(r.terminalName || ""),
      jumperFootage: fmtNum(r.jumperFootage as number),
      aerialPrimary: fmtNum(r.aerialPrimary as number),
      aerialAdditional: fmtNum(r.aerialAdditional as number),
      undergroundPrimary: fmtNum(r.undergroundPrimary as number),
      undergroundAdditional: fmtNum(r.undergroundAdditional as number),
      terminalPlaced: r.terminalPlaced === true ? "✓" : "",
      terminalPlacedDate: fmtDate(r.terminalPlacedDate as string),
      terminalTestedDate: fmtDate(r.terminalTestedDate as string),
    })),
  };
}

export function buildPriceTableDef(
  records: Record<string, unknown>[],
  pricesEntries: Record<string, unknown>[],
  variant: "admin" | "team",
  marker: string
): TableDef {
  const priceColumns = [
    { key: "description", label: "Description", widthPt: 250 },
    { key: "printLoc", label: "Print / Loc" },
    { key: "qty", label: "Initial QTY" },
    { key: "rate", label: "Initial Rate" },
    { key: "amount", label: "Initial Amount" },
  ];

  return {
    marker,
    columns: priceColumns,
    records: buildPriceRows(records, pricesEntries, variant),
  };
}

export function buildPicturesGrid(records: Record<string, unknown>[]): PicturesGridDef {
  const pictureUrls: string[] = [];
  for (const r of records) {
    if (r.terminalPlacedPicture) pictureUrls.push(String(r.terminalPlacedPicture));
    if (r.terminalTestedPicture) pictureUrls.push(String(r.terminalTestedPicture));
  }

  return {
    marker: "dtapRecordPictures",
    title: "PICTURES",
    imageUrls: pictureUrls,
  };
}

export function extractDriveFileId(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)\//);
  return match ? match[1] : null;
}

/**
 * Build the full payload needed to generate both admin and team PDFs for one invoice.
 */
export function buildInvoicePayload(bundle: InvoiceBundle): InvoicePayload {
  const { invoice, dtap, team, wireCenter, records, pricesEntries } = bundle;

  return {
    commonReplacements: buildCommonReplacements(invoice, dtap, team, wireCenter, records),
    recordsTableDef: buildRecordsTableDef(records),
    adminPriceTableDef: buildPriceTableDef(records, pricesEntries, "admin", "adminPriceTable"),
    teamPriceTableDef: buildPriceTableDef(records, pricesEntries, "team", "teamPriceTable"),
    picturesGrid: buildPicturesGrid(records),
    invoiceNum: String(invoice.invoiceNumber || invoice._id),
    dtapLabel: String(dtap?.dtap || "DTAP"),
  };
}
