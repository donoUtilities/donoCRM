/**
 * Pre-compute Invoice Totals Migration
 *
 * This script iterates all DtapInvoices and computes adminInvoiceTotal
 * and teamInvoiceTotal from their linked dtapItemsIds (DtapRecords),
 * then stores them directly on each invoice document.
 *
 * Run once: npx tsx scripts/precompute-totals.ts
 *
 * After running, the /api/dtap-invoices route no longer needs to
 * fetch DtapRecords at all for the list view.
 */

import { readFileSync } from "fs";
import { MongoClient, ObjectId } from "mongodb";

// Load .env.local manually
const envFile = readFileSync(".env.local", "utf-8");
for (const line of envFile.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
}

const uri = process.env.NUXT_DONO_MONGODB_URI!;
const DB_NAME = "DonoUtilities";

async function precomputeTotals() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    console.log("Connected to MongoDB Atlas");

    const invCol = db.collection("DonoUtilities_DtapInvoices");
    const recCol = db.collection("DonoUtilities_DtapRecords");

    const invoices = await invCol.find({}).toArray();
    console.log(`Found ${invoices.length} invoices to process`);

    let updated = 0;
    let skipped = 0;

    for (const inv of invoices) {
      const itemIds = Array.isArray(inv.dtapItemsIds)
        ? inv.dtapItemsIds.map((id: { toString(): string }) => new ObjectId(id.toString()))
        : [];

      if (itemIds.length === 0) {
        // No linked records — set totals to 0
        await invCol.updateOne(
          { _id: inv._id },
          { $set: { adminInvoiceTotal: 0, teamInvoiceTotal: 0 } }
        );
        skipped++;
        continue;
      }

      // Use aggregation to sum values in MongoDB
      const [result] = await recCol
        .aggregate([
          { $match: { _id: { $in: itemIds } } },
          {
            $group: {
              _id: null,
              adminInvoiceTotal: { $sum: { $toDouble: { $ifNull: ["$saleValue", 0] } } },
              teamInvoiceTotal: { $sum: { $toDouble: { $ifNull: ["$totalValue", 0] } } },
            },
          },
        ])
        .toArray();

      const adminInvoiceTotal = result?.adminInvoiceTotal || 0;
      const teamInvoiceTotal = result?.teamInvoiceTotal || 0;

      await invCol.updateOne(
        { _id: inv._id },
        { $set: { adminInvoiceTotal, teamInvoiceTotal } }
      );

      updated++;
      if (updated % 50 === 0) {
        console.log(`  Processed ${updated}/${invoices.length}...`);
      }
    }

    console.log(`\n✓ Done! Updated: ${updated}, Skipped (no items): ${skipped}`);
  } catch (error) {
    console.error("Failed to precompute totals:", error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

precomputeTotals();
