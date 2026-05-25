import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

const DB_NAME = "DonoUtilities";
const COLLECTION = "DonoUtilities_BspdItems";
const PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const skip = (page - 1) * PAGE_SIZE;

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const col = db.collection(COLLECTION);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseQueries: Promise<any>[] = [
      col.find({}).sort({ _id: -1 }).skip(skip).limit(PAGE_SIZE).toArray(),
      col.countDocuments(),
      // Lookup tables for ObjectId references
      db.collection("DonoUtilities_Users").find({}, { projection: { name: 1 } }).toArray(),
      db.collection("DonoUtilities_Bspd").find({}, { projection: { feeder: 1 } }).toArray(),
    ];

    // On page 1, fetch distinct filter values from full DB
    if (page === 1) {
      baseQueries.push(
        col.distinct("feederId"),
        col.distinct("item"),
        col.distinct("uom"),
        col.distinct("completedBy"),
      );
    }

    const results = await Promise.all(baseQueries);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [docs, totalCount, users, bspds] = results as [any[], number, any[], any[]];

    // Build lookup maps
    const userMap = new Map<string, string>();
    for (const u of users) userMap.set(u._id.toString(), u.name || "");

    const feederMap = new Map<string, string>();
    for (const b of bspds) feederMap.set(b._id.toString(), b.feeder || "");

    const serialized = docs.map((d) => ({
      _id: d._id.toString(),
      feeder: d.feederId ? feederMap.get(d.feederId.toString()) || "" : "",
      item: d.item || "",
      itemDescription: d.itemDescription || "",
      actualFT: d.actualFT ?? null,
      uom: d.uom || "",
      tickMarkStart: d.tickMarkStart ?? null,
      tickMarkStartPicture: d.tickMarkStartPicture || "",
      tickMarkEnd: d.tickMarkEnd ?? null,
      tickMarkEndPicture: d.tickMarkEndPicture || "",
      redLines: d.redLines || "",
      workProcesPicture: d.workProcesPicture || "",
      additionalPicture: d.additionalPicture || "",
      price: d.price ?? null,
      salePrice: d.salePrice ?? null,
      completedBy: d.completedBy ? userMap.get(d.completedBy.toString()) || "" : "",
      completedAt: d.completedAt || "",
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: Record<string, any> = {
      data: serialized,
      page,
      totalCount,
      totalPages: Math.ceil(totalCount / PAGE_SIZE),
    };

    if (page === 1) {
      const [feederIds, items, uoms, completedByIds] = results.slice(4) as [string[], string[], string[], string[]];
      // Resolve ObjectIds to names for filter dropdowns
      const feederNames = feederIds
        .map((id) => feederMap.get(id?.toString?.() || "") || "")
        .filter(Boolean);
      const completedByNames = completedByIds
        .map((id) => userMap.get(id?.toString?.() || "") || "")
        .filter(Boolean);
      response.filterOptions = {
        feeders: [...new Set(feederNames)].sort(),
        items: items.filter(Boolean).sort(),
        uoms: uoms.filter(Boolean).sort(),
        completedBys: [...new Set(completedByNames)].sort(),
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch BSPD Records:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
