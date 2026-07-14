import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { env } from "@/lib/env";
import { withAuth } from "@/lib/with-auth";

const DB_NAME = "DonoUtilities";
const COLLECTION = "DonoUtilities_BspdItems";
const BSPD_COL = "DonoUtilities_Bspd";
const USERS_COL = "DonoUtilities_Users";

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
    const tableName = "BSPDItems";

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
      console.error("AppSheet API returned error for BSPDItems:", errorText);
      return NextResponse.json(
        { error: `AppSheet API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const rows = await response.json();
    if (!Array.isArray(rows)) {
      console.error("Invalid response format from AppSheet for BSPDItems:", rows);
      return NextResponse.json(
        { error: "Invalid response format from AppSheet" },
        { status: 500 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Fetch lookup collections
    const [bspds, users] = await Promise.all([
      db.collection(BSPD_COL).find({}).toArray(),
      db.collection(USERS_COL).find({}).toArray(),
    ]);

    const bspdNameToIdMap = new Map<string, string>();
    for (const b of bspds) {
      const feeder = (b.feeder || "").toString().toLowerCase().trim();
      if (feeder) {
        bspdNameToIdMap.set(feeder, b._id.toString());
      }
      const legacyId = (b.legacy_id || "").toString().toLowerCase().trim();
      if (legacyId) {
        bspdNameToIdMap.set(legacyId, b._id.toString());
      }
    }

    const userEmailToIdMap = new Map<string, string>();
    for (const u of users) {
      const email = (u.email || "").toString().toLowerCase().trim();
      if (email) {
        userEmailToIdMap.set(email, u._id.toString());
      }
      const name = (u.name || "").toString().toLowerCase().trim();
      if (name) {
        userEmailToIdMap.set(name, u._id.toString());
      }
    }

    const bulkOps: any[] = [];

    for (const row of rows) {
      const legacyId = (row.RecordId || "").toString().trim();
      if (!legacyId) continue;

      const feederInput = (row.Feeder || "").toString().toLowerCase().trim();
      const feederId = bspdNameToIdMap.get(feederInput) || "";

      const userVal = (row["Completed By"] || "").toString().toLowerCase().trim();
      const completedBy = userEmailToIdMap.get(userVal) || "";

      const actualFTVal = row["Actual ft"];
      const actualFT = actualFTVal !== null && actualFTVal !== undefined && actualFTVal !== ""
        ? parseFloat(actualFTVal)
        : null;

      const tickMarkStartVal = row["Tick Mark Start"];
      const tickMarkStart = tickMarkStartVal !== null && tickMarkStartVal !== undefined && tickMarkStartVal !== ""
        ? parseFloat(tickMarkStartVal)
        : null;

      const tickMarkEndVal = row["Tick Mark End"];
      const tickMarkEnd = tickMarkEndVal !== null && tickMarkEndVal !== undefined && tickMarkEndVal !== ""
        ? parseFloat(tickMarkEndVal)
        : null;

      const priceVal = row.Price;
      const price = priceVal !== null && priceVal !== undefined && priceVal !== ""
        ? parseFloat(priceVal)
        : null;

      const salePriceVal = row["Sale Price"];
      const salePrice = salePriceVal !== null && salePriceVal !== undefined && salePriceVal !== ""
        ? parseFloat(salePriceVal)
        : null;

      const tickMarkStartPicture = getAppSheetFileUrl(tableName, row["Tick Mark Start Picture"] || "");
      const tickMarkEndPicture = getAppSheetFileUrl(tableName, row["Tick Mark End Picture"] || "");
      const redLines = getAppSheetFileUrl(tableName, row["Red Lines"] || "");
      const workProcesPicture = getAppSheetFileUrl(tableName, row["Work Proces Picture"] || "");
      const additionalPicture = getAppSheetFileUrl(tableName, row["Additional Picture"] || "");

      bulkOps.push({
        updateOne: {
          filter: { legacy_id: legacyId },
          update: {
            $set: {
              legacy_id: legacyId,
              feederId: feederId ? new ObjectId(feederId) : "",
              item: (row.Item || "").toString().trim(),
              itemDescription: (row["Item Description"] || "").toString().trim(),
              actualFT,
              uom: (row.UOM || "").toString().trim(),
              tickMarkStart,
              tickMarkStartPicture,
              tickMarkEnd,
              tickMarkEndPicture,
              redLines,
              workProcesPicture,
              additionalPicture,
              price,
              salePrice,
              completedBy: completedBy ? new ObjectId(completedBy) : "",
              completedAt: (row["Completed On"] || "").toString().trim(),
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
      message: `BSPD Records synced successfully. Total rows processed: ${rows.length}`,
      count: rows.length,
    });
  } catch (error) {
    console.error("Error syncing BSPD Records:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
});
