import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { withAuth } from "@/lib/with-auth";

const DB_NAME = "DonoUtilities";
const COLLECTION = "DonoUtilities_BspdInvoices";
const PAGE_SIZE = 100;

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const skip = (page - 1) * PAGE_SIZE;

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const col = db.collection(COLLECTION);

    const [docs, totalCount, bspdItems, bspds, teams, wireCenters] = await Promise.all([
      col.find({}).sort({ _id: -1 }).skip(skip).limit(PAGE_SIZE).toArray(),
      col.countDocuments(),
      // Get feederId and item for each BspdItem so we can resolve invoice → feeder & item names
      db.collection("DonoUtilities_BspdItems").find({}, { projection: { feederId: 1, item: 1 } }).toArray(),
      db.collection("DonoUtilities_Bspd").find(
        { feeder: { $exists: true, $ne: null } },
        { projection: { feeder: 1, wireCenter: 1, wireCenterId: 1, team: 1, teamId: 1 } }
      ).toArray(),
      db.collection("DonoUtilities_Teams").find({}, { projection: { team: 1, name: 1 } }).toArray(),
      db.collection("DonoUtilities_WireCenter").find({}, { projection: { wireCenter: 1, name: 1 } }).toArray(),
    ]);

    // Build lookup maps
    const teamMap = new Map<string, string>();
    for (const t of teams) teamMap.set(t._id.toString(), t.team || t.name || "");
    const wcMap = new Map<string, string>();
    for (const w of wireCenters) wcMap.set(w._id.toString(), w.wireCenter || w.name || "");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bspdMap = new Map<string, any>();
    const feederMap = new Map<string, string>();
    for (const b of bspds) {
      const id = b._id.toString();
      feederMap.set(id, b.feeder || "");
      bspdMap.set(id, b);
    }

    // Map BspdItem _id → feederId and item name
    const itemToFeederId = new Map<string, string>();
    const itemNameMap = new Map<string, string>();
    for (const item of bspdItems) {
      if (item.feederId) itemToFeederId.set(item._id.toString(), item.feederId.toString());
      if (item.item) itemNameMap.set(item._id.toString(), item.item);
    }

    // Resolve invoice → feeder name via first bspdItemsIds entry
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function resolveFeeder(doc: any): string {
      // Direct feederId on the invoice
      if (doc.feederId) {
        const name = feederMap.get(doc.feederId.toString());
        if (name) return name;
      }
      // Indirect: first item's feederId → Bspd.feeder
      if (Array.isArray(doc.bspdItemsIds) && doc.bspdItemsIds.length) {
        const firstItemId = doc.bspdItemsIds[0].toString();
        const fId = itemToFeederId.get(firstItemId);
        if (fId) return feederMap.get(fId) || "";
      }
      return "";
    }

    // Resolve feederId to the Bspd document
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function resolveBspdDoc(doc: any): any | null {
      if (doc.feederId) {
        const b = bspdMap.get(doc.feederId.toString());
        if (b) return b;
      }
      if (Array.isArray(doc.bspdItemsIds) && doc.bspdItemsIds.length) {
        const firstItemId = doc.bspdItemsIds[0].toString();
        const fId = itemToFeederId.get(firstItemId);
        if (fId) return bspdMap.get(fId) || null;
      }
      return null;
    }

    // Resolve wireCenter name from a Bspd document
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function resolveWireCenter(bspd: any): string {
      if (!bspd) return "";
      const ref = bspd.wireCenterId || bspd.wireCenter;
      if (!ref) return "";
      return wcMap.get(ref.toString()) || String(ref);
    }

    // Resolve team name from a Bspd document
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function resolveTeam(bspd: any): string {
      if (!bspd) return "";
      const ref = bspd.teamId || bspd.team;
      if (!ref) return "";
      return teamMap.get(ref.toString()) || String(ref);
    }

    // Resolve invoice → list of item names from bspdItemsIds
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function resolveItemNames(doc: any): string[] {
      if (!Array.isArray(doc.bspdItemsIds)) return [];
      return doc.bspdItemsIds
        .map((id: { toString(): string }) => itemNameMap.get(id.toString()) || "")
        .filter(Boolean);
    }

    // Matches AppSheet: CONCATENATE(YEAR([Date]-1),"-",WEEKNUM([Date]-1))
    // Subtract 1 day, then use Excel-style WEEKNUM (Sunday-based, week 1 contains Jan 1)
    function getWeek(dateStr: string): string {
      if (!dateStr) return "";
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "";
        // Subtract 1 day (shifts week start from Sunday to Saturday)
        const shifted = new Date(d);
        shifted.setDate(shifted.getDate() - 1);
        const year = shifted.getFullYear();
        const jan1 = new Date(year, 0, 1);
        const daysSinceJan1 = Math.floor((shifted.getTime() - jan1.getTime()) / 86400000);
        const jan1Day = jan1.getDay(); // 0=Sun
        const weekNum = Math.floor((daysSinceJan1 + jan1Day) / 7) + 1;
        return `${year}-${weekNum}`;
      } catch { return ""; }
    }

    const serialized = docs.map((d) => {
      const bspd = resolveBspdDoc(d);
      return {
        _id: d._id.toString(),
        invoiceNumber: d.invoiceNumber || "",
        date: d.date || "",
        week: getWeek(d.date || ""),
        feederName: resolveFeeder(d),
        wireCenter: resolveWireCenter(bspd),
        team: resolveTeam(bspd),
        bspdItems: resolveItemNames(d),
        bspdItemsCount: Array.isArray(d.bspdItemsIds) ? d.bspdItemsIds.length : 0,
        isPaid: !!d.isPaid,
        createdOn: d.createdOn || "",
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: Record<string, any> = {
      data: serialized,
      page,
      totalCount,
      totalPages: Math.ceil(totalCount / PAGE_SIZE),
    };

    if (page === 1) {
      // Collect all unique filter values across all invoices (full scan on page 1)
      const allInvoices = await col.find({}, { projection: { bspdItemsIds: 1, feederId: 1, date: 1 } }).toArray();
      const feederNameSet = new Set<string>();
      const wireCenterSet = new Set<string>();
      const teamSet = new Set<string>();
      const weekSet = new Set<string>();
      for (const inv of allInvoices) {
        const name = resolveFeeder(inv);
        if (name) feederNameSet.add(name);
        const bspd = resolveBspdDoc(inv);
        const wc = resolveWireCenter(bspd);
        if (wc) wireCenterSet.add(wc);
        const tm = resolveTeam(bspd);
        if (tm) teamSet.add(tm);
        const wk = getWeek(inv.date || "");
        if (wk) weekSet.add(wk);
      }
      response.filterOptions = {
        feeders: [...feederNameSet].sort(),
        wireCenters: [...wireCenterSet].sort(),
        teams: [...teamSet].sort(),
        weeks: [...weekSet].sort((a, b) => {
          const [ya, wa] = a.split("-").map(Number);
          const [yb, wb] = b.split("-").map(Number);
          return yb - ya || wb - wa;
        }),
        payments: ["Paid", "Unpaid"],
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch BSPD Invoices:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
});
