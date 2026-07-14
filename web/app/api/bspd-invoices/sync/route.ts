import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { env } from "@/lib/env";
import { withAuth } from "@/lib/with-auth";

const DB_NAME = "DonoUtilities";
const BSPD_INVOICES_COLLECTION = "DonoUtilities_BspdInvoices";
const BSPD_ITEMS_COLLECTION = "DonoUtilities_BspdItems";
const BSPD_COLLECTION = "DonoUtilities_Bspd";

export const POST = withAuth(async () => {
  try {
    const appId = env.APPSHEET_APP_ID;
    const accessKey = env.APPSHEET_ACCESS_KEY;
    const tableName = "BSPDInvoices";

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
      console.error("AppSheet API returned error for BSPDInvoices:", errorText);
      return NextResponse.json(
        { error: `AppSheet API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const rows = await response.json();
    if (!Array.isArray(rows)) {
      console.error("Invalid response format from AppSheet for BSPDInvoices:", rows);
      return NextResponse.json(
        { error: "Invalid response format from AppSheet" },
        { status: 500 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Fetch lookup collections
    const [bspds, items] = await Promise.all([
      db.collection(BSPD_COLLECTION).find({}).toArray(),
      db.collection(BSPD_ITEMS_COLLECTION).find({}, { projection: { _id: 1, legacy_id: 1 } }).toArray(),
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

    const itemLegacyIdToObjectIdMap = new Map<string, string>();
    for (const item of items) {
      const lid = (item.legacy_id || "").toString().trim();
      if (lid) {
        itemLegacyIdToObjectIdMap.set(lid, item._id.toString());
      }
    }

    const bulkOps: any[] = [];

    for (const row of rows) {
      const legacyId = (row.RecordId || "").toString().trim();
      const invoiceNumber = (row["Invoice #"] || "").toString().trim();
      if (!invoiceNumber) continue;

      const dateStr = (row.Date || "").toString().trim();
      
      const feederInput = (row.BSPD || "").toString().toLowerCase().trim();
      const feederId = bspdNameToIdMap.get(feederInput) || "";

      const isPaid = row.Paid === "Y" || row.Paid === "true" || row.Paid === true;
      const createdOnStr = (row.TimeStamp || "").toString().trim();

      // Parse BSPDItems: split by comma, spaces, or parse array
      let bspdItemsIds: ObjectId[] = [];
      const rawItems = row.BSPDItems;
      if (rawItems) {
        let itemKeys: string[] = [];
        if (Array.isArray(rawItems)) {
          itemKeys = rawItems.map(k => k.toString().trim());
        } else if (typeof rawItems === "string") {
          itemKeys = rawItems.split(/[\s,;\n\r]+/).map(k => k.trim()).filter(Boolean);
        }
        for (const k of itemKeys) {
          const recId = itemLegacyIdToObjectIdMap.get(k);
          if (recId) {
            bspdItemsIds.push(new ObjectId(recId));
          }
        }
      }

      const updateDoc: Record<string, any> = {
        $set: {
          invoiceNumber,
          date: dateStr,
          feederId: feederId ? new ObjectId(feederId) : "",
          bspdItemsIds,
          isPaid,
          createdOn: createdOnStr || dateStr,
          updatedAt: new Date(),
        },
      };

      if (legacyId) {
        updateDoc.$setOnInsert = {
          legacy_id: legacyId,
        };
      }

      bulkOps.push({
        updateOne: {
          filter: { invoiceNumber },
          update: updateDoc,
          upsert: true,
        },
      });
    }

    if (bulkOps.length > 0) {
      await db.collection(BSPD_INVOICES_COLLECTION).bulkWrite(bulkOps);
    }

    return NextResponse.json({
      message: `BSPD Invoices synced successfully. Total rows processed: ${rows.length}`,
      count: rows.length,
    });
  } catch (error) {
    console.error("Error syncing BSPD Invoices:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
});
