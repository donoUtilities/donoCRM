import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { env } from "@/lib/env";
import { withAuth } from "@/lib/with-auth";

const DB_NAME = "DonoUtilities";
const COLLECTION = "DonoUtilities_TreeTrim";
const TEAMS_COL = "DonoUtilities_Teams";
const WC_COL = "DonoUtilities_WireCenter";
const BSPD_COL = "DonoUtilities_Bspd";
const DTAP_COL = "DonoUtilities_Dtap";

function getAppSheetFileUrl(tableName: string, fileName: string) {
  if (!fileName || typeof fileName !== "string" || fileName.startsWith("http://") || fileName.startsWith("https://")) {
    return fileName || "";
  }
  return `https://www.appsheet.com/template/gettablefileurl?appName=DONOUTILITIESConnector-112585626&tableName=${tableName}&fileName=${encodeURIComponent(fileName.trim())}`;
}

export const POST = withAuth(async () => {
  try {
    const appId = env.APPSHEET_APP_ID;
    const accessKey = env.APPSHEET_ACCESS_KEY;
    const tableName = "TreeTrim";

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
      console.error("AppSheet API returned error for TreeTrim:", errorText);
      return NextResponse.json(
        { error: `AppSheet API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const rows = await response.json();
    if (!Array.isArray(rows)) {
      console.error("Invalid response format from AppSheet for TreeTrim:", rows);
      return NextResponse.json(
        { error: "Invalid response format from AppSheet" },
        { status: 500 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Fetch lookup collections
    const [teams, wcs, bspds, dtaps] = await Promise.all([
      db.collection(TEAMS_COL).find({}).toArray(),
      db.collection(WC_COL).find({}).toArray(),
      db.collection(BSPD_COL).find({}).toArray(),
      db.collection(DTAP_COL).find({}).toArray(),
    ]);

    const teamNameToIdMap = new Map<string, string>();
    for (const t of teams) {
      const name = (t.team || t.name || "").toString().toLowerCase().trim();
      if (name) teamNameToIdMap.set(name, t._id.toString());
    }

    const wcNameToIdMap = new Map<string, string>();
    for (const w of wcs) {
      const name = (w.wireCenter || w.name || "").toString().toLowerCase().trim();
      if (name) wcNameToIdMap.set(name, w._id.toString());
    }

    const bspdNameToIdMap = new Map<string, string>();
    for (const b of bspds) {
      const feeder = (b.feeder || "").toString().toLowerCase().trim();
      if (feeder) bspdNameToIdMap.set(feeder, b._id.toString());
      const lid = (b.legacy_id || "").toString().toLowerCase().trim();
      if (lid) bspdNameToIdMap.set(lid, b._id.toString());
    }

    const dtapNameToIdMap = new Map<string, string>();
    for (const d of dtaps) {
      const name = (d.dtapName || "").toString().toLowerCase().trim();
      if (name) dtapNameToIdMap.set(name, d._id.toString());
      const lid = (d.legacy_id || "").toString().toLowerCase().trim();
      if (lid) dtapNameToIdMap.set(lid, d._id.toString());
    }

    const bulkOps: any[] = [];

    for (const row of rows) {
      const legacyId = (row.RecordId || "").toString().trim();
      if (!legacyId) continue;

      const teamInput = (row.Team || "").toString().toLowerCase().trim();
      const teamId = teamNameToIdMap.get(teamInput) || "";

      const wcInput = (row["Wire Center"] || "").toString().toLowerCase().trim();
      const wireCenterId = wcNameToIdMap.get(wcInput) || "";

      const feederInput = (row["Choose BSPD"] || "").toString().toLowerCase().trim();
      const feeder = bspdNameToIdMap.get(feederInput) || "";

      const dtapInput = (row["Choose DTAP"] || "").toString().toLowerCase().trim();
      const dtap = dtapNameToIdMap.get(dtapInput) || "";

      const totalFeetVal = row["Total ft"];
      const totalFeet = totalFeetVal !== null && totalFeetVal !== undefined && totalFeetVal !== ""
        ? parseFloat(totalFeetVal)
        : null;

      const beforePicture = getAppSheetFileUrl(tableName, row["Before Picture"] || "");
      const afterPicture = getAppSheetFileUrl(tableName, row["After Picture"] || "");
      const redLinePicture = getAppSheetFileUrl(tableName, row["Red Line Picture"] || "");

      bulkOps.push({
        updateOne: {
          filter: { legacy_id: legacyId },
          update: {
            $set: {
              legacy_id: legacyId,
              teamId: teamId ? new ObjectId(teamId) : "",
              bspdORdtap: (row["BSPD or DTAP"] || "").toString().trim(),
              wireCenterId: wireCenterId ? new ObjectId(wireCenterId) : "",
              feeder: feeder ? new ObjectId(feeder) : "",
              dtap: dtap ? new ObjectId(dtap) : "",
              totalFeet,
              beforePicture,
              fiberFusionFibererial: (row["Fiber Fusion per Fibererial"] || "").toString().trim(),
              afterPicture,
              redLinePicture,
              invoiceRequested: (row["Invoice Requested"] || "").toString().trim(),
              requestedOn: (row["Requested TimeStamp"] || "").toString().trim(),
              updatedAt: new Date(),
            },
          },
          upsert: true,
        },
      });
    }

    if (bulkOps.length > 0) {
      await db.collection(COLLECTION).bulkWrite(bulkOps);
    }

    return NextResponse.json({
      message: `Tree Trim Records synced successfully. Total rows processed: ${rows.length}`,
      count: rows.length,
    });
  } catch (error) {
    console.error("Error syncing Tree Trim Records:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
});
