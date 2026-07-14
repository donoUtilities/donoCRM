import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { env } from "@/lib/env";
import { withAuth } from "@/lib/with-auth";

const DB_NAME = "DonoUtilities";
const BSPD_COLLECTION = "DonoUtilities_Bspd";
const TEAMS_COLLECTION = "DonoUtilities_Teams";
const WC_COLLECTION = "DonoUtilities_WireCenter";

export const POST = withAuth(async () => {
  try {
    const appId = env.APPSHEET_APP_ID;
    const accessKey = env.APPSHEET_ACCESS_KEY;
    const tableName = "BSPD";

    // Call AppSheet REST API
    const response = await fetch(
      `https://api.appsheet.com/api/v2/apps/${appId}/tables/${tableName}/Action`,
      {
        method: "POST",
        headers: {
          "applicationAccessKey": accessKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Action: "Find",
          Properties: {
            Locale: "en-US",
            Timezone: "UTC",
          },
          Rows: [],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AppSheet API returned error for BSPD:", errorText);
      return NextResponse.json(
        { error: `AppSheet API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const rows = await response.json();
    if (!Array.isArray(rows)) {
      console.error("Invalid response format from AppSheet for BSPD:", rows);
      return NextResponse.json(
        { error: "Invalid response format from AppSheet" },
        { status: 500 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Fetch lookup collections
    const [teams, wcs] = await Promise.all([
      db.collection(TEAMS_COLLECTION).find({}).toArray(),
      db.collection(WC_COLLECTION).find({}).toArray(),
    ]);

    const teamNameToIdMap = new Map<string, string>();
    for (const t of teams) {
      const name = (t.team || t.name || "").toString().toLowerCase().trim();
      if (name) {
        teamNameToIdMap.set(name, t._id.toString());
      }
    }

    const wcNameToIdMap = new Map<string, string>();
    for (const w of wcs) {
      const name = (w.wireCenter || w.name || "").toString().toLowerCase().trim();
      if (name) {
        wcNameToIdMap.set(name, w._id.toString());
      }
    }

    const bulkOps: any[] = [];

    for (const row of rows) {
      const legacyId = (row.BSPDId || "").toString().trim();
      if (!legacyId) continue;

      const wcInput = (row["Wire Center"] || "").toString().toLowerCase().trim();
      const wireCenterId = wcNameToIdMap.get(wcInput) || "";

      const teamInput = (row.Team || "").toString().toLowerCase().trim();
      const teamId = teamNameToIdMap.get(teamInput) || "";

      const totalFTVal = row["Total [ft]"];
      const totalFT = totalFTVal !== null && totalFTVal !== undefined && totalFTVal !== ""
        ? parseFloat(totalFTVal)
        : null;

      bulkOps.push({
        updateOne: {
          filter: { legacy_id: legacyId },
          update: {
            $set: {
              legacy_id: legacyId,
              feeder: (row.Feeder || "").toString().trim(),
              wireCenterId: wireCenterId ? new ObjectId(wireCenterId) : "",
              cableType: (row["Cable Type"] || "").toString().trim(),
              totalFT,
              teamId: teamId ? new ObjectId(teamId) : "",
              BSPDCompleteInFull: (row["BSPD Complete in Full"] || "").toString().trim(),
              completionDate: (row["Completion Date"] || "").toString().trim(),
              invoiceStatus: (row["Invoice Status"] || "").toString().trim(),
              requestedTimeStamp: (row["Requested TimeStamp"] || "").toString().trim(),
              updatedAt: new Date(),
            },
          },
          upsert: true,
        },
      });
    }

    if (bulkOps.length > 0) {
      await db.collection(BSPD_COLLECTION).bulkWrite(bulkOps);
    }

    return NextResponse.json({
      message: `BSPD records synced successfully. Total rows processed: ${rows.length}`,
      count: rows.length,
    });
  } catch (error) {
    console.error("Error syncing BSPD:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
});
