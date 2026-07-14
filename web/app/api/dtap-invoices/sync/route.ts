import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { env } from "@/lib/env";
import { withAuth } from "@/lib/with-auth";

const DB_NAME = "DonoUtilities";
const DTAP_INVOICES_COLLECTION = "DonoUtilities_DtapInvoices";
const DTAP_RECORDS_COLLECTION = "DonoUtilities_DtapRecords";
const DTAP_COLLECTION = "DonoUtilities_Dtap";
const TEAMS_COLLECTION = "DonoUtilities_Teams";
const WC_COLLECTION = "DonoUtilities_WireCenter";

export const POST = withAuth(async () => {
  try {
    const appId = env.APPSHEET_APP_ID;
    const accessKey = env.APPSHEET_ACCESS_KEY;
    const tableName = "DTAPInvoices";

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
      console.error("AppSheet API returned error for DTAPInvoices:", errorText);
      return NextResponse.json(
        { error: `AppSheet API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const rows = await response.json();
    if (!Array.isArray(rows)) {
      console.error("Invalid response format from AppSheet for DTAPInvoices:", rows);
      return NextResponse.json(
        { error: "Invalid response format from AppSheet" },
        { status: 500 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Fetch lookup collections
    const [dtaps, teams, wcs, records] = await Promise.all([
      db.collection(DTAP_COLLECTION).find({}).toArray(),
      db.collection(TEAMS_COLLECTION).find({}).toArray(),
      db.collection(WC_COLLECTION).find({}).toArray(),
      db.collection(DTAP_RECORDS_COLLECTION).find({}, { projection: { _id: 1, legacy_id: 1 } }).toArray(),
    ]);

    // Construct maps
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

    const recordLegacyIdToObjectIdMap = new Map<string, string>();
    for (const r of records) {
      const lid = (r.legacy_id || "").toString().trim();
      if (lid) {
        recordLegacyIdToObjectIdMap.set(lid, r._id.toString());
      }
    }

    const bulkOps: any[] = [];

    for (const row of rows) {
      const legacyId = (row.RecordId || "").toString().trim();
      const invoiceNumber = (row["Invoice #"] || "").toString().trim();
      if (!invoiceNumber) continue;

      const dateStr = (row.Date || "").toString().trim();
      const week = (row.Week || "").toString().trim();
      
      const dtapInput = (row.DTAP || "").toString().toLowerCase().trim();
      const dtapId = dtapNameToIdMap.get(dtapInput) || "";

      const teamInput = (row.Team || "").toString().toLowerCase().trim();
      const teamId = teamNameToIdMap.get(teamInput) || "";

      const wcInput = (row.Location || "").toString().toLowerCase().trim();
      const wireCenterId = wcNameToIdMap.get(wcInput) || "";

      const isPaid = row.Paid === "Y" || row.Paid === "true" || row.Paid === true;
      const createdOnStr = (row.TimeStamp || "").toString().trim();

      // Parse DTAPItems: split by comma, spaces, or parse array
      let dtapItemsIds: ObjectId[] = [];
      const rawItems = row.DTAPItems;
      if (rawItems) {
        let itemKeys: string[] = [];
        if (Array.isArray(rawItems)) {
          itemKeys = rawItems.map(k => k.toString().trim());
        } else if (typeof rawItems === "string") {
          itemKeys = rawItems.split(/[\s,;\n\r]+/).map(k => k.trim()).filter(Boolean);
        }
        for (const k of itemKeys) {
          const recId = recordLegacyIdToObjectIdMap.get(k);
          if (recId) {
            dtapItemsIds.push(new ObjectId(recId));
          }
        }
      }

      const updateDoc: Record<string, any> = {
        $set: {
          invoiceNumber,
          date: dateStr,
          dtapId: dtapId ? new ObjectId(dtapId) : "",
          dtapItemsIds,
          week,
          teamId: teamId ? new ObjectId(teamId) : "",
          wireCenterId: wireCenterId ? new ObjectId(wireCenterId) : "",
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
      await db.collection(DTAP_INVOICES_COLLECTION).bulkWrite(bulkOps);
    }

    return NextResponse.json({
      message: `DTAP Invoices synced successfully. Total rows processed: ${rows.length}`,
      count: rows.length,
    });
  } catch (error) {
    console.error("Error syncing DTAP Invoices:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
});
