/**
 * MongoDB Index Setup for DonoUtilities
 * 
 * Run once: npx tsx scripts/setup-indexes.ts
 * 
 * These indexes dramatically speed up the most common queries
 * by avoiding full collection scans on the M10 Atlas cluster.
 */

import { readFileSync } from "fs";
import { MongoClient } from "mongodb";

// Load .env.local manually
const envFile = readFileSync(".env.local", "utf-8");
for (const line of envFile.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
}

const uri = process.env.NUXT_DONO_MONGODB_URI!;
const DB_NAME = "DonoUtilities";

async function setupIndexes() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    console.log("Connected to MongoDB Atlas");

    // DtapRecords: indexed by dtapId (used in detail page lookup)
    await db.collection("DonoUtilities_DtapRecords").createIndex(
      { dtapId: 1 },
      { name: "idx_dtapRecords_dtapId", background: true }
    );
    console.log("✓ DonoUtilities_DtapRecords.dtapId index created");

    // DtapInvoices: indexed by dtapId (used in detail page invoice lookup)
    await db.collection("DonoUtilities_DtapInvoices").createIndex(
      { dtapId: 1 },
      { name: "idx_dtapInvoices_dtapId", background: true }
    );
    console.log("✓ DonoUtilities_DtapInvoices.dtapId index created");

    // Dtap: compound index on commonly filtered fields
    await db.collection("DonoUtilities_Dtap").createIndex(
      { completionStatus: 1, testingStatus: 1, invoiceStatus: 1 },
      { name: "idx_dtap_statuses", background: true }
    );
    console.log("✓ DonoUtilities_Dtap status compound index created");

    // DtapPrices: index on type + category (filter fields)
    await db.collection("DonoUtilities_DtapPrices").createIndex(
      { type: 1, category: 1 },
      { name: "idx_dtapPrices_type_category", background: true }
    );
    console.log("✓ DonoUtilities_DtapPrices type+category index created");

    // Bspd: compound index on commonly filtered/looked-up fields
    await db.collection("DonoUtilities_Bspd").createIndex(
      { wireCenterId: 1, teamId: 1, invoiceStatus: 1 },
      { name: "idx_bspd_wc_team_invoice", background: true }
    );
    console.log("✓ DonoUtilities_Bspd wireCenterId+teamId+invoiceStatus index created");

    // ── Indexes for dtap-invoices aggregation pipeline ──

    // DtapInvoices: week index (used for distinct week filter options)
    await db.collection("DonoUtilities_DtapInvoices").createIndex(
      { week: 1 },
      { name: "idx_dtapInvoices_week", background: true }
    );
    console.log("✓ DonoUtilities_DtapInvoices.week index created");

    // DtapInvoices: isPaid index (used for payment status filter)
    await db.collection("DonoUtilities_DtapInvoices").createIndex(
      { isPaid: 1 },
      { name: "idx_dtapInvoices_isPaid", background: true }
    );
    console.log("✓ DonoUtilities_DtapInvoices.isPaid index created");

    // Dtap: dtap field index (used for distinct dtap name filter options)
    await db.collection("DonoUtilities_Dtap").createIndex(
      { dtap: 1 },
      { name: "idx_dtap_name", background: true }
    );
    console.log("✓ DonoUtilities_Dtap.dtap name index created");

    // DtapInvoices: dtapItemsIds multikey index (used for reverse $lookup in dtap-records)
    await db.collection("DonoUtilities_DtapInvoices").createIndex(
      { dtapItemsIds: 1 },
      { name: "idx_dtapInvoices_dtapItemsIds", background: true }
    );
    console.log("✓ DonoUtilities_DtapInvoices.dtapItemsIds index created");

    // DtapRecords: taskStatus index (used for distinct filter options)
    await db.collection("DonoUtilities_DtapRecords").createIndex(
      { taskStatus: 1 },
      { name: "idx_dtapRecords_taskStatus", background: true }
    );
    console.log("✓ DonoUtilities_DtapRecords.taskStatus index created");

    console.log("\nAll indexes created successfully!");
  } catch (error) {
    console.error("Failed to create indexes:", error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

setupIndexes();
