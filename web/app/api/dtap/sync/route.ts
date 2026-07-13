import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { env } from "@/lib/env";
import { withAuth } from "@/lib/with-auth";

const DB_NAME = "DonoUtilities";
const DTAP_COLLECTION = "DonoUtilities_Dtap";
const TEAMS_COLLECTION = "DonoUtilities_Teams";
const WC_COLLECTION = "DonoUtilities_WireCenter";

export const POST = withAuth(async () => {
  try {
    const appId = env.APPSHEET_APP_ID;
    const accessKey = env.APPSHEET_ACCESS_KEY;
    const tableName = "DTAP";

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
      console.error("AppSheet API returned error for DTAP:", errorText);
      return NextResponse.json(
        { error: `AppSheet API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const rows = await response.json();

    if (!Array.isArray(rows)) {
      console.error("AppSheet response is not an array for DTAP:", rows);
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
    for (const team of teams) {
      const name = (team.team || team.name || "").toString().toLowerCase().trim();
      if (name) {
        teamNameToIdMap.set(name, team._id.toString());
      }
    }

    const wcNameToIdMap = new Map<string, string>();
    for (const wc of wcs) {
      const name = (wc.wireCenter || wc.name || "").toString().toLowerCase().trim();
      if (name) {
        wcNameToIdMap.set(name, wc._id.toString());
      }
    }

    // Process and normalize the DTAP rows
    const normalizedDtaps = [];
    for (const row of rows) {
      const legacyId = row.DTAPId;
      if (!legacyId || typeof legacyId !== "string") {
        continue;
      }

      const dtap = row.DTAP || "";
      const wireCenterInput = (row["Wire Center"] || "").toString().toLowerCase().trim();
      const wireCenterId = wcNameToIdMap.get(wireCenterInput) || "";

      const teamInput = (row.TEAM || "").toString().toLowerCase().trim();
      const teamId = teamNameToIdMap.get(teamInput) || "";

      const completionStatus = row["Completion Status"] || "";
      const testingStatus = row["Testing Status"] || "";
      const invoiceStatus = row["Invoice Status"] || "";
      const requestedTimeStamp = row["Requested TimeStamp"] || "";

      normalizedDtaps.push({
        legacy_id: legacyId.trim(),
        dtap: dtap.trim(),
        wireCenterId: wireCenterId ? new ObjectId(wireCenterId) : "",
        teamId: teamId ? new ObjectId(teamId) : "",
        completionStatus: completionStatus.trim(),
        testingStatus: testingStatus.trim(),
        invoiceStatus: invoiceStatus.trim(),
        requestedTimeStamp: requestedTimeStamp.trim(),
      });
    }

    if (normalizedDtaps.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No valid DTAP records found in AppSheet to sync.",
        syncedCount: 0,
      });
    }

    // Perform bulk upserts matching by legacy_id
    const bulkOps = normalizedDtaps.map((item) => ({
      updateOne: {
        filter: { legacy_id: item.legacy_id },
        update: {
          $set: {
            legacy_id: item.legacy_id,
            dtap: item.dtap,
            wireCenterId: item.wireCenterId,
            teamId: item.teamId,
            completionStatus: item.completionStatus,
            testingStatus: item.testingStatus,
            invoiceStatus: item.invoiceStatus,
            requestedTimeStamp: item.requestedTimeStamp,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    const result = await db.collection(DTAP_COLLECTION).bulkWrite(bulkOps);

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${normalizedDtaps.length} DTAPs.`,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount,
    });
  } catch (error) {
    console.error("Failed to sync DTAPs with AppSheet:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync DTAPs" },
      { status: 500 }
    );
  }
});
