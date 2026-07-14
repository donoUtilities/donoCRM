import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { env } from "@/lib/env";
import { withAuth } from "@/lib/with-auth";

const DB_NAME = "DonoUtilities";
const COLLECTION = "DonoUtilities_TreeTrimInvoices";
const TEAMS_COL = "DonoUtilities_Teams";
const TREETRIM_COL = "DonoUtilities_TreeTrim";

export const POST = withAuth(async () => {
  try {
    const appId = env.APPSHEET_APP_ID;
    const accessKey = env.APPSHEET_ACCESS_KEY;
    const tableName = "TreeTrimInvoices";

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
      console.error("AppSheet API returned error for TreeTrimInvoices:", errorText);
      return NextResponse.json(
        { error: `AppSheet API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const rows = await response.json();
    if (!Array.isArray(rows)) {
      console.error("Invalid response format from AppSheet for TreeTrimInvoices:", rows);
      return NextResponse.json(
        { error: "Invalid response format from AppSheet" },
        { status: 500 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Fetch lookup collections
    const [teams, treeTrimItems] = await Promise.all([
      db.collection(TEAMS_COL).find({}).toArray(),
      db.collection(TREETRIM_COL).find({}, { projection: { _id: 1, legacy_id: 1 } }).toArray(),
    ]);

    const teamNameToIdMap = new Map<string, string>();
    for (const t of teams) {
      const name = (t.team || t.name || "").toString().toLowerCase().trim();
      if (name) teamNameToIdMap.set(name, t._id.toString());
    }

    const treeTrimLegacyIdToObjectIdMap = new Map<string, string>();
    for (const item of treeTrimItems) {
      const lid = (item.legacy_id || "").toString().trim();
      if (lid) treeTrimLegacyIdToObjectIdMap.set(lid, item._id.toString());
    }

    const bulkOps: any[] = [];

    for (const row of rows) {
      const legacyId = (row.RecordId || "").toString().trim();
      const invoiceNumber = (row["Invoice #"] || "").toString().trim();
      if (!invoiceNumber) continue;

      const dateStr = (row.Date || "").toString().trim();
      const bspdORDtap = (row["BSPD or DTAP"] || "").toString().trim();
      const teamInput = (row.Team || "").toString().toLowerCase().trim();
      const teamId = teamNameToIdMap.get(teamInput) || "";
      const isPaid = row.Paid === "Y" || row.Paid === "true" || row.Paid === true;
      const createdOnStr = (row.TimeStamp || "").toString().trim();

      // Parse TreeTrimItems: split by comma, spaces, or parse array
      let treeTrimItems: ObjectId[] = [];
      const rawItems = row.TreeTrimItems;
      if (rawItems) {
        let itemKeys: string[] = [];
        if (Array.isArray(rawItems)) {
          itemKeys = rawItems.map(k => k.toString().trim());
        } else if (typeof rawItems === "string") {
          itemKeys = rawItems.split(/[\s,;\n\r]+/).map(k => k.trim()).filter(Boolean);
        }
        for (const k of itemKeys) {
          const recId = treeTrimLegacyIdToObjectIdMap.get(k);
          if (recId) treeTrimItems.push(new ObjectId(recId));
        }
      }

      const updateDoc: Record<string, any> = {
        $set: {
          invoiceNumber,
          date: dateStr,
          bspdORDtap,
          treeTrimItems,
          team: teamId ? new ObjectId(teamId) : "",
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
      await db.collection(COLLECTION).bulkWrite(bulkOps);
    }

    return NextResponse.json({
      message: `Tree Trim Invoices synced successfully. Total rows processed: ${rows.length}`,
      count: rows.length,
    });
  } catch (error) {
    console.error("Error syncing Tree Trim Invoices:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
});
