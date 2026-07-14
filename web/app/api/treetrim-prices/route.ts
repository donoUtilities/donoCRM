import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { withAuth } from "@/lib/with-auth";

const DB_NAME = "DonoUtilities";
const COLLECTION = "DonoUtilities_TreeTrimPrices";
const PAGE_SIZE = 100;

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const skip = (page - 1) * PAGE_SIZE;

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const col = db.collection(COLLECTION);

    const baseQueries: Promise<any>[] = [
      col.find({}).sort({ _id: -1 }).skip(skip).limit(PAGE_SIZE).toArray(),
      col.countDocuments(),
    ];

    if (page === 1) {
      baseQueries.push(col.distinct("uom"));
    }

    const results = await Promise.all(baseQueries);
    const [docs, totalCount] = results as [any[], number];

    const serialized = docs.map((d) => ({
      _id: d._id.toString(),
      itemNumber: d.itemNumber || "",
      itemDescription: d.itemDescription || "",
      uom: d.uom || "",
      tier1: d.tier1 ?? null,
      tier2: d.tier2 ?? null,
      tier3: d.tier3 ?? null,
      salePrice: d.salePrice ?? null,
    }));

    const response: Record<string, any> = {
      data: serialized,
      page,
      totalCount,
      totalPages: Math.ceil(totalCount / PAGE_SIZE),
    };

    if (page === 1) {
      const [uoms] = results.slice(2) as [string[]];
      response.filterOptions = {
        uoms: uoms.filter(Boolean).sort(),
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch Tree Trim Prices:", error);
    return NextResponse.json(
      { error: "Failed to fetch Tree Trim Prices" },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const result = await db.collection(COLLECTION).insertOne({
      itemNumber: body.itemNumber || "",
      itemDescription: body.itemDescription || "",
      uom: body.uom || "",
      tier1: body.tier1 ?? null,
      tier2: body.tier2 ?? null,
      tier3: body.tier3 ?? null,
      salePrice: body.salePrice ?? null,
    });
    return NextResponse.json({
      _id: result.insertedId.toString(),
      ...body,
    });
  } catch (error) {
    console.error("Failed to create Tree Trim Price:", error);
    return NextResponse.json(
      { error: "Failed to create Tree Trim Price" },
      { status: 500 }
    );
  }
});
