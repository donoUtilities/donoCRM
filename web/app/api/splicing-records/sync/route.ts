import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { env } from "@/lib/env";
import { withAuth } from "@/lib/with-auth";

const DB_NAME = "DonoUtilities";
const COLLECTION = "DonoUtilities_Splicing";
const TEAMS_COL = "DonoUtilities_Teams";
const WC_COL = "DonoUtilities_WireCenter";
const BSPD_COL = "DonoUtilities_Bspd";
const DTAP_COL = "DonoUtilities_Dtap";
const USERS_COL = "DonoUtilities_Users";

function getAppSheetFileUrl(tableName: string, fileName: string) {
  if (!fileName || typeof fileName !== "string" || fileName.startsWith("http://") || fileName.startsWith("https://")) {
    return fileName || "";
  }
  return `https://www.appsheet.com/template/gettablefileurl?appId=DONOUTILITIESConnector-112585626&appName=DONOUTILITIESConnector-112585626&tableName=${tableName}&fileName=${encodeURIComponent(fileName.trim())}`;
}

export const POST = withAuth(async () => {
  try {
    const appId = env.APPSHEET_APP_ID;
    const accessKey = env.APPSHEET_ACCESS_KEY;
    const tableName = "Splicing";

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
      console.error("AppSheet API returned error for Splicing:", errorText);
      return NextResponse.json(
        { error: `AppSheet API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const rows = await response.json();
    if (!Array.isArray(rows)) {
      console.error("Invalid response format from AppSheet for Splicing:", rows);
      return NextResponse.json(
        { error: "Invalid response format from AppSheet" },
        { status: 500 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Fetch lookup collections
    const [teams, wcs, bspds, dtaps, users] = await Promise.all([
      db.collection(TEAMS_COL).find({}).toArray(),
      db.collection(WC_COL).find({}).toArray(),
      db.collection(BSPD_COL).find({}).toArray(),
      db.collection(DTAP_COL).find({}).toArray(),
      db.collection(USERS_COL).find({}).toArray(),
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

    const userEmailToIdMap = new Map<string, string>();
    for (const u of users) {
      const email = (u.email || "").toString().toLowerCase().trim();
      if (email) userEmailToIdMap.set(email, u._id.toString());
      const name = (u.name || "").toString().toLowerCase().trim();
      if (name) userEmailToIdMap.set(name, u._id.toString());
    }

    const bulkOps: any[] = [];

    for (const row of rows) {
      const legacyId = (row.RecordId || "").toString().trim();
      if (!legacyId) continue;

      const teamInput = (row.Team || "").toString().toLowerCase().trim();
      const teamId = teamNameToIdMap.get(teamInput) || "";

      const wcInput = (row["Wire Center"] || "").toString().toLowerCase().trim();
      const wireCenterId = wcNameToIdMap.get(wcInput) || "";

      const feederInput = (row["Feeder BSPD #"] || "").toString().toLowerCase().trim();
      const feeder = bspdNameToIdMap.get(feederInput) || "";

      // Parse Feeder BSPD Splice to (comma-separated list of reference keys)
      let feederSpliceTo: ObjectId[] = [];
      const rawSpliceTo = row["Feeder BSPD Splice to"];
      if (rawSpliceTo) {
        let spliceKeys: string[] = [];
        if (Array.isArray(rawSpliceTo)) {
          spliceKeys = rawSpliceTo.map(k => k.toString().trim().toLowerCase());
        } else if (typeof rawSpliceTo === "string") {
          spliceKeys = rawSpliceTo.split(/[\s,;\n\r]+/).map(k => k.trim().toLowerCase()).filter(Boolean);
        }
        for (const k of spliceKeys) {
          const recId = bspdNameToIdMap.get(k);
          if (recId) feederSpliceTo.push(new ObjectId(recId));
        }
      }

      const dtapInput = (row.DTAP || "").toString().toLowerCase().trim();
      const dtap = dtapNameToIdMap.get(dtapInput) || "";

      const completedByInput = (row["Completed By"] || "").toString().toLowerCase().trim();
      const completedBy = userEmailToIdMap.get(completedByInput) || "";

      const fiberFusionVal = row["Fiber Fusion per Fibererial Number"];
      const fiberFusionFibererialNumber = fiberFusionVal !== null && fiberFusionVal !== undefined && fiberFusionVal !== ""
        ? parseFloat(fiberFusionVal)
        : null;

      const ribbonVal = row["Splice / Test Fiber Fusion per Ribbon Number"];
      const spliceTestFiberFusionRibbonNumber = ribbonVal !== null && ribbonVal !== undefined && ribbonVal !== ""
        ? parseFloat(ribbonVal)
        : null;

      const partialRibbonVal = row["Splice / Test Fiber Fusion per Partial Ribbon Number"];
      const spliceTestFiberFusionPartialRibbonNumber = partialRibbonVal !== null && partialRibbonVal !== undefined && partialRibbonVal !== ""
        ? parseFloat(partialRibbonVal)
        : null;

      const spliceDTAP = row["Splice DTAP"] === "Y" || row["Splice DTAP"] === "true" || row["Splice DTAP"] === true;

      // Group images
      const singleSplicePictures: string[] = [];
      for (let i = 1; i <= 6; i++) {
        const pic = row[`Single Splice Picture ${i}`];
        if (pic) singleSplicePictures.push(getAppSheetFileUrl(tableName, pic));
      }

      const ribbonSplicePictures: string[] = [];
      for (let i = 1; i <= 6; i++) {
        const pic = row[`Ribbon Splice Picture ${i}`];
        if (pic) ribbonSplicePictures.push(getAppSheetFileUrl(tableName, pic));
      }

      const partialRibbonSplicePictures: string[] = [];
      for (let i = 1; i <= 6; i++) {
        const pic = row[`Partial Ribbon Splice Picture ${i}`];
        if (pic) partialRibbonSplicePictures.push(getAppSheetFileUrl(tableName, pic));
      }

      const portPictures: string[] = [];
      for (let i = 1; i <= 6; i++) {
        const pic = row[`Port Picture ${i}`];
        if (pic) portPictures.push(getAppSheetFileUrl(tableName, pic));
      }

      const teardownAerialPicture = getAppSheetFileUrl(tableName, row["Teardown Aerial Picture"] || "");
      const casePlacementPicture = getAppSheetFileUrl(tableName, row["Case Placement Picture"] || "");
      const spliceDTAPPicture = getAppSheetFileUrl(tableName, row["Splice DTAP Picture"] || "");
      const placeDTAPAerialPicture = getAppSheetFileUrl(tableName, row["Place DTAP - aerial Picture"] || "");

      bulkOps.push({
        updateOne: {
          filter: { legacy_id: legacyId },
          update: {
            $set: {
              legacy_id: legacyId,
              teamId: teamId ? new ObjectId(teamId) : "",
              bspdORdtap: (row["BSPD or DTAP"] || "").toString().trim(),
              wireCenterId: wireCenterId ? new ObjectId(wireCenterId) : "",
              cableType: (row["Cable Type"] || "").toString().trim(),
              feeder: feeder ? new ObjectId(feeder) : "",
              feederSpliceTo,
              dtap: dtap ? new ObjectId(dtap) : "",
              spliceSetupTeardownAerial: (row["Splice Setup - Teardown Aerial"] || "").toString().trim(),
              teardownAerialPicture,
              fiberFusionFibererial: (row["Fiber Fusion per Fibererial"] || "").toString().trim(),
              fiberFusionFibererialNumber,
              singleSplicePictures,
              spliceTestFiberFusionRibbon: (row["Splice / Test Fiber Fusion per Ribbon"] || "").toString().trim(),
              spliceTestFiberFusionRibbonNumber,
              ribbonSplicePictures,
              spliceTestFiberFusionPartialRibbon: (row["Splice / Test Fiber Fusion per Partial Ribbon"] || "").toString().trim(),
              spliceTestFiberFusionPartialRibbonNumber,
              partialRibbonSplicePictures,
              casePlacement: (row["Case Placement"] || "").toString().trim(),
              casePlacementPicture,
              spliceDTAP,
              spliceDTAPPicture,
              placeDTAPAerial: (row["Place DTAP - aerial"] || "").toString().trim(),
              placeDTAPAerialPicture,
              testDTAPPwrMtrOtdr: (row["Test DTAP - PWR- MTR OTDR"] || "").toString().trim(),
              portPictures,
              completedBy: completedBy ? new ObjectId(completedBy) : "",
              completedOn: (row["Completed On"] || "").toString().trim(),
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
      message: `Splicing Records synced successfully. Total rows processed: ${rows.length}`,
      count: rows.length,
    });
  } catch (error) {
    console.error("Error syncing Splicing Records:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
});
