import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { env } from "@/lib/env";
import { withAuth } from "@/lib/with-auth";

const DB_NAME = "DonoUtilities";
const DTAP_RECORDS_COLLECTION = "DonoUtilities_DtapRecords";
const DTAP_COLLECTION = "DonoUtilities_Dtap";
const TEAMS_COLLECTION = "DonoUtilities_Teams";
const WC_COLLECTION = "DonoUtilities_WireCenter";

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
    const tableName = "DtapRecords";

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
      console.error("AppSheet API returned error for DtapRecords:", errorText);
      return NextResponse.json(
        { error: `AppSheet API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const rows = await response.json();

    if (!Array.isArray(rows)) {
      console.error("AppSheet response is not an array for DtapRecords:", rows);
      return NextResponse.json(
        { error: "Invalid response format from AppSheet" },
        { status: 500 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Fetch lookup collections
    const [dtaps, teams, wcs] = await Promise.all([
      db.collection(DTAP_COLLECTION).find({}).toArray(),
      db.collection(TEAMS_COLLECTION).find({}).toArray(),
      db.collection(WC_COLLECTION).find({}).toArray(),
    ]);

    const dtapNameToIdMap = new Map<string, string>();
    for (const d of dtaps) {
      const name = (d.dtap || "").toString().toLowerCase().trim();
      if (name) {
        dtapNameToIdMap.set(name, d._id.toString());
      }
      const legacyId = (d.legacy_id || "").toString().toLowerCase().trim();
      if (legacyId) {
        dtapNameToIdMap.set(legacyId, d._id.toString());
      }
    }

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

    // Process and normalize the DTAP Records rows
    const normalizedRecords = [];
    for (const row of rows) {
      const legacyId = row.RecordId;
      if (!legacyId || typeof legacyId !== "string") {
        continue;
      }

      // Foreign Key lookup maps
      const dtapInput = (row.DTAP || "").toString().toLowerCase().trim();
      const dtapId = dtapNameToIdMap.get(dtapInput) || "";

      const wcInput = (row["Wire Center"] || "").toString().toLowerCase().trim();
      const wireCenterId = wcNameToIdMap.get(wcInput) || "";

      const teamInput = (row.Team || "").toString().toLowerCase().trim();
      const teamId = teamNameToIdMap.get(teamInput) || "";

      // Image Columns converted to readable URLs
      const terminalPlacedPicture = getAppSheetFileUrl(tableName, row["Terminal Placed Picture"] || "");
      const terminalTestedPicture = getAppSheetFileUrl(tableName, row["Terminal Tested Picture"] || "");

      // Booleans
      const terminalPlaced = row["Terminal Placed"] === "Y" || row["Terminal Placed"] === "true" || row["Terminal Placed"] === true;
      const terminalTested = row["Terminal Tested"] === "Y" || row["Terminal Tested"] === "true" || row["Terminal Tested"] === true;
      const isInvoice = row["Invoice Status"] === "Y" || row["Invoice Status"] === "true" || row["Invoice Status"] === true || !!row["Invoice Status"];

      normalizedRecords.push({
        legacy_id: legacyId.trim(),
        dtapId: dtapId ? new ObjectId(dtapId) : "",
        wireCenterId: wireCenterId ? new ObjectId(wireCenterId) : "",
        teamId: teamId ? new ObjectId(teamId) : "",
        
        terminalRun: parseInt(row["Terminal Run"] || "0", 10),
        jumperFootage: parseInt(row["Jumper Footage"] || "0", 10),
        aerialPrimary: parseInt(row["Aerial Primary"] || "0", 10),
        aerialAdditional: parseInt(row["Aerial Additional"] || "0", 10),
        undergroundPrimary: parseInt(row["Underground Primary"] || "0", 10),
        undergroundAdditional: parseInt(row["Underground Additional"] || "0", 10),
        
        terminalName: (row["Terminal Name"] || "").toString().trim(),
        termPortAndPower: (row["Term Port and Power"] || "").toString().trim(),
        termPlacement: (row["Term Placement"] || "").toString().trim(),
        build: (row.Build || "").toString().trim(),
        servedHouseholds: parseInt(row["Served Households"] || "0", 10),
        
        aerialPrimaryPercent: (row["Aerial Primary Percent"] || "").toString().trim(),
        aerialAdditionalPercent: (row["Aerial Additional Percent"] || "").toString().trim(),
        ugPrimaryPercent: (row["UG Primary Percent"] || "").toString().trim(),
        ugAdditionalPercent: (row["UG Additional Percent"] || "").toString().trim(),
        
        aerialPrimaryValue: parseFloat(row["Aerial Primary Value"] || "0"),
        aerialAdditionalValue: parseFloat(row["Aerial Additional Value"] || "0"),
        ugPrimaryValue: parseFloat(row["UG Primary Value"] || "0"),
        ugAdditionalValue: parseFloat(row["UG Additional Value"] || "0"),
        
        aerialPrimarySaleValue: parseFloat(row["Aerial Primary Sale Value"] || "0"),
        aerialAdditionalSaleValue: parseFloat(row["Aerial Additional Sale Value"] || "0"),
        ugPrimarySaleValue: parseFloat(row["UG Primary Sale Value"] || "0"),
        ugAdditionalSaleValue: parseFloat(row["UG Additional Sale Value"] || "0"),
        
        placedPrice: parseFloat(row["Placed Price"] || "0"),
        placedSalePrice: parseFloat(row["Placed Sale Price"] || "0"),
        testedPrice: parseFloat(row["Tested Price"] || "0"),
        testedSalePrice: parseFloat(row["Tested Sale Price"] || "0"),
        totalValue: parseFloat(row["Total Value"] || "0"),
        saleValue: parseFloat(row["Sale Value"] || "0"),
        
        terminalPlaced,
        terminalPlacedDate: (row["Terminal Placed Date"] || "").toString().trim(),
        terminalPlacedPicture,
        terminalTested,
        lightLevel: (row["Light Level"] || "").toString().trim(),
        terminalTestedPicture,
        terminalTestedDate: (row["Terminal Tested Date"] || "").toString().trim(),
        comments: (row.Comments || "").toString().trim(),
        
        tier: (row.Tier || "").toString().trim(),
        
        aerialPrimaryPriceTeam: parseFloat(row["Aerial Primary Price Team"] || "0"),
        aerialPrimaryPriceAdmin: parseFloat(row["Aerial Primary Price Admin"] || "0"),
        aerialAdditionalPriceTeam: parseFloat(row["Aerial Additional Price Team"] || "0"),
        aerialAdditionalPriceAdmin: parseFloat(row["Aerial Additional Price Admin"] || "0"),
        ugPrimaryPriceTeam: parseFloat(row["UG Primary Price Team"] || "0"),
        ugPrimaryPriceAdmin: parseFloat(row["UG Primary Price Admin"] || "0"),
        ugAdditionalPriceTeam: parseFloat(row["UG Additional Price Team"] || "0"),
        ugAdditionalPriceAdmin: parseFloat(row["UG Additional Price Admin"] || "0"),
        
        taskStatus: (row["Task Status"] || "").toString().trim(),
        isInvoice,
      });
    }

    if (normalizedRecords.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No valid DTAP record rows found in AppSheet to sync.",
        syncedCount: 0,
      });
    }

    // Perform bulk upserts matching by legacy_id
    const bulkOps = normalizedRecords.map((item) => ({
      updateOne: {
        filter: { legacy_id: item.legacy_id },
        update: {
          $set: {
            ...item,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    const result = await db.collection(DTAP_RECORDS_COLLECTION).bulkWrite(bulkOps);

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${normalizedRecords.length} DTAP records.`,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount,
    });
  } catch (error) {
    console.error("Failed to sync DTAP Records with AppSheet:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync DTAP records" },
      { status: 500 }
    );
  }
});
