import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { env } from "@/lib/env";
import { withAuth } from "@/lib/with-auth";

const DB_NAME = "DonoUtilities";
const WIRE_CENTERS_COLLECTION = "DonoUtilities_WireCenter";

export const POST = withAuth(async () => {
  try {
    const appId = env.APPSHEET_APP_ID;
    const accessKey = env.APPSHEET_ACCESS_KEY;
    const tableName = "Locations";

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
      console.error("AppSheet API returned error for Locations:", errorText);
      return NextResponse.json(
        { error: `AppSheet API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const rows = await response.json();

    if (!Array.isArray(rows)) {
      console.error("AppSheet response is not an array for Locations:", rows);
      return NextResponse.json(
        { error: "Invalid response format from AppSheet" },
        { status: 500 }
      );
    }

    // Process and normalize the location/wireCenter rows
    const normalizedLocations = [];
    for (const row of rows) {
      const locationName = row.Location;
      if (!locationName || typeof locationName !== "string") {
        continue;
      }

      normalizedLocations.push({
        wireCenter: locationName.trim(),
      });
    }

    if (normalizedLocations.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No valid location records found in AppSheet to sync.",
        syncedCount: 0,
      });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Perform bulk upserts matching by wireCenter name
    const bulkOps = normalizedLocations.map((loc) => ({
      updateOne: {
        filter: { wireCenter: loc.wireCenter },
        update: {
          $set: {
            wireCenter: loc.wireCenter,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    const result = await db.collection(WIRE_CENTERS_COLLECTION).bulkWrite(bulkOps);

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${normalizedLocations.length} wire centers.`,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount,
    });
  } catch (error) {
    console.error("Failed to sync wire centers with AppSheet:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync wire centers" },
      { status: 500 }
    );
  }
});
