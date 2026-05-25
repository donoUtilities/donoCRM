import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

const DB_NAME = "DonoUtilities";
const COLLECTION = "DonoUtilities_DtapPrices";
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
    ];

    if (page === 1) {
      baseQueries.push(col.distinct("type"), col.distinct("category"));
    }

    const results = await Promise.all(baseQueries);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [docs, totalCount] = results as [any[], number];

    const serialized = docs.map((d) => ({
      _id: d._id.toString(),
      itemNumber: d.itemNumber || "",
      jumperFootage: d.jumperFootage,
      itemDescription: d.itemDescription || "",
      uom: d.uom || "",
      type: d.type || "",
      category: d.category || "",
      tier1: d.tier1,
      tier2: d.tier2,
      tier3: d.tier3,
      salePrice: d.salePrice,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: Record<string, any> = {
      data: serialized,
      page,
      totalCount,
      totalPages: Math.ceil(totalCount / PAGE_SIZE),
    };

    if (page === 1) {
      const [types, categories] = results.slice(2) as [string[], string[]];
      response.filterOptions = {
        types: types.filter(Boolean).sort(),
        categories: categories.filter(Boolean).sort(),
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch DTAP Prices:", error);
    return NextResponse.json(
      { error: "Failed to fetch DTAP Prices" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const result = await db.collection(COLLECTION).insertOne({
      itemNumber: body.itemNumber || "",
      jumperFootage: body.jumperFootage ?? null,
      itemDescription: body.itemDescription || "",
      uom: body.uom || "",
      type: body.type || "",
      category: body.category || "",
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
    console.error("Failed to create DTAP Price:", error);
    return NextResponse.json(
      { error: "Failed to create DTAP Price" },
      { status: 500 }
    );
  }
}
