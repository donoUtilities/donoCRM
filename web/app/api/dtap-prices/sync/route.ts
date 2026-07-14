import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { env } from "@/lib/env";
import { withAuth } from "@/lib/with-auth";

const DB_NAME = "DonoUtilities";
const COLLECTION = "DonoUtilities_DtapPrices";

export const POST = withAuth(async () => {
  try {
    const appId = env.APPSHEET_APP_ID;
    const accessKey = env.APPSHEET_ACCESS_KEY;
    const tableName = "DTAPPrices";

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
      console.error("AppSheet API returned error for DTAPPrices:", errorText);
      return NextResponse.json(
        { error: `AppSheet API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const rows = await response.json();
    if (!Array.isArray(rows)) {
      console.error("Invalid response format from AppSheet for DTAPPrices:", rows);
      return NextResponse.json(
        { error: "Invalid response format from AppSheet" },
        { status: 500 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const bulkOps: any[] = [];

    for (const row of rows) {
      const itemNumber = (row["Item Number"] || "").toString().trim();
      if (!itemNumber) continue;

      const jumperFootageVal = row["Jumper Footage"];
      const jumperFootage = jumperFootageVal !== null && jumperFootageVal !== undefined && jumperFootageVal !== ""
        ? parseInt(jumperFootageVal, 10)
        : null;

      const tier1Val = row["Tier 1"];
      const tier1 = tier1Val !== null && tier1Val !== undefined && tier1Val !== ""
        ? parseFloat(tier1Val)
        : null;

      const tier2Val = row["Tier 2"];
      const tier2 = tier2Val !== null && tier2Val !== undefined && tier2Val !== ""
        ? parseFloat(tier2Val)
        : null;

      const tier3Val = row["Tier 3"];
      const tier3 = tier3Val !== null && tier3Val !== undefined && tier3Val !== ""
        ? parseFloat(tier3Val)
        : null;

      const salePriceVal = row["Sale Price"];
      const salePrice = salePriceVal !== null && salePriceVal !== undefined && salePriceVal !== ""
        ? parseFloat(salePriceVal)
        : null;

      bulkOps.push({
        updateOne: {
          filter: { itemNumber },
          update: {
            $set: {
              itemNumber,
              jumperFootage,
              itemDescription: (row["Item Description"] || "").toString().trim(),
              uom: (row.UOM || "").toString().trim(),
              type: (row.Type || "").toString().trim(),
              category: (row.Category || "").toString().trim(),
              tier1,
              tier2,
              tier3,
              salePrice,
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
      message: `DTAP Prices synced successfully. Total rows processed: ${rows.length}`,
      count: rows.length,
    });
  } catch (error) {
    console.error("Error syncing DTAP Prices:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
});
