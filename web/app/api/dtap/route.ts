import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { withAuth } from "@/lib/with-auth";

const DB_NAME = "DonoUtilities";
const DTAP_COLLECTION = "DonoUtilities_Dtap";
const TEAMS_COLLECTION = "DonoUtilities_Teams";
const WC_COLLECTION = "DonoUtilities_WireCenter";
const PAGE_SIZE = 100;

// Only fetch the fields we actually display
const DTAP_PROJECTION = {
  dtap: 1,
  teamId: 1,
  wireCenterId: 1,
  completionStatus: 1,
  testingStatus: 1,
  requestedTimeStamp: 1,
  invoiceStatus: 1,
};

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const skip = (page - 1) * PAGE_SIZE;

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const col = db.collection(DTAP_COLLECTION);

    // Core data + lookup tables (always needed)
    const baseQueries: Promise<unknown>[] = [
      col.find({}, { projection: DTAP_PROJECTION }).sort({ _id: -1 }).skip(skip).limit(PAGE_SIZE).toArray(),
      col.countDocuments(),
      db.collection(TEAMS_COLLECTION).find({}, { projection: { team: 1, name: 1 } }).toArray(),
      db.collection(WC_COLLECTION).find({}, { projection: { wireCenter: 1, name: 1 } }).toArray(),
    ];

    // On page 1, also fetch distinct filter values from full DB
    if (page === 1) {
      baseQueries.push(
        col.distinct("completionStatus"),
        col.distinct("testingStatus"),
        col.distinct("invoiceStatus"),
      );
    }

    const results = await Promise.all(baseQueries);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [dtaps, totalCount, teams, wireCenters] = results as [any[], number, any[], any[]];

    // Build lookup maps
    const teamMap = new Map<string, string>();
    for (const t of teams) teamMap.set(t._id.toString(), t.team || t.name || "");
    const wcMap = new Map<string, string>();
    for (const w of wireCenters) wcMap.set(w._id.toString(), w.wireCenter || w.name || "");

    const serialized = dtaps.map((d) => {
      const teamIdStr = d.teamId ? d.teamId.toString() : "";
      const wcIdStr = d.wireCenterId ? d.wireCenterId.toString() : "";
      return {
        _id: d._id.toString(),
        dtap: d.dtap || "",
        wireCenterId: wcIdStr,
        wireCenterName: wcMap.get(wcIdStr) || "",
        teamId: teamIdStr,
        teamName: teamMap.get(teamIdStr) || "",
        completionStatus: d.completionStatus || "",
        testingStatus: d.testingStatus || "",
        requestedTimeStamp: d.requestedTimeStamp || "",
        invoiceStatus: d.invoiceStatus || "",
      };
    });

    const response: Record<string, unknown> = {
      data: serialized,
      page,
      totalCount,
      totalPages: Math.ceil(totalCount / PAGE_SIZE),
    };

    // Attach filter options on page 1
    if (page === 1) {
      const [completionStatuses, testingStatuses, invoiceStatuses] = results.slice(4) as [string[], string[], string[]];
      // Wire centers & teams come from their lookup collections (already complete)
      const wcNames = [...wcMap.values()].filter(Boolean).sort();
      const teamNames = [...teamMap.values()].filter(Boolean).sort();
      response.filterOptions = {
        wireCenters: wcNames,
        teams: teamNames,
        completionStatuses: completionStatuses.filter(Boolean).sort(),
        testingStatuses: testingStatuses.filter(Boolean).sort(),
        invoiceStatuses: invoiceStatuses.filter(Boolean).sort(),
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch DTAPs:", error);
    return NextResponse.json({ error: "Failed to fetch DTAPs" }, { status: 500 });
  }
});
