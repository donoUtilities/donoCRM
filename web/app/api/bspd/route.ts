import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

const DB_NAME = "DonoUtilities";
const PAGE_SIZE = 100;
const BSPD_COL = "DonoUtilities_Bspd";

const PROJECTION = {
  feeder: 1,
  legacy_id: 1,
  wireCenter: 1,
  wireCenterId: 1,
  cableType: 1,
  totalFT: 1,
  team: 1,
  teamId: 1,
  BSPDCompleteInFull: 1,
  completionDate: 1,
  invoiceStatus: 1,
  requestedTimeStamp: 1,
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const skip = (page - 1) * PAGE_SIZE;

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const col = db.collection(BSPD_COL);

    const bspdFilter = { feeder: { $exists: true, $ne: null } };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseQueries: Promise<any>[] = [
      col.find(bspdFilter, { projection: PROJECTION }).sort({ _id: -1 }).skip(skip).limit(PAGE_SIZE).toArray(),
      col.countDocuments(bspdFilter),
      db.collection("DonoUtilities_Teams").find({}, { projection: { team: 1, name: 1 } }).toArray(),
      db.collection("DonoUtilities_WireCenter").find({}, { projection: { wireCenter: 1, name: 1 } }).toArray(),
    ];

    // On page 1, fetch distinct filter values from full DB
    if (page === 1) {
      baseQueries.push(
        col.distinct("cableType", bspdFilter),
        col.distinct("invoiceStatus", bspdFilter),
      );
    }

    const results = await Promise.all(baseQueries);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [records, totalCount, teams, wireCenters] = results as [any[], number, any[], any[]];

    // Build lookup maps
    const teamMap = new Map<string, string>();
    for (const t of teams) teamMap.set(t._id.toString(), t.team || t.name || "");
    const wcMap = new Map<string, string>();
    for (const w of wireCenters) wcMap.set(w._id.toString(), w.wireCenter || w.name || "");

    const serialized = records.map((r) => {
      const wcRef = r.wireCenterId || r.wireCenter;
      const teamRef = r.teamId || r.team;

      return {
        _id: r._id.toString(),
        feeder: r.feeder || "",
        wireCenter: wcRef ? wcMap.get(wcRef.toString()) || "" : "",
        cableType: r.cableType || "",
        totalFT: r.totalFT ?? null,
        team: teamRef ? teamMap.get(teamRef.toString()) || "" : "",
        BSPDCompleteInFull: r.BSPDCompleteInFull ?? null,
        completionDate: r.completionDate || "",
        invoiceStatus: r.invoiceStatus || "",
        requestedTimeStamp: r.requestedTimeStamp || "",
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
      const [cableTypes, invoiceStatuses] = results.slice(4) as [string[], string[]];
      response.filterOptions = {
        wireCenters: [...wcMap.values()].filter(Boolean).sort(),
        cableTypes: cableTypes.filter(Boolean).sort(),
        teams: [...teamMap.values()].filter(Boolean).sort(),
        invoiceStatuses: invoiceStatuses.filter(Boolean).sort(),
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch BSPD:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
