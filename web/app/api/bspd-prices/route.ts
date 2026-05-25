import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { withAuth } from "@/lib/with-auth";

const DB_NAME = "DonoUtilities";
const COLLECTION = "DonoUtilities_BspdPrices";
const PAGE_SIZE = 100;

export const GET = withAuth(async (request) => {
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
      baseQueries.push(
        col.distinct("uom"),
      );
    }

    const results = await Promise.all(baseQueries);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [docs, totalCount] = results as [any[], number];

    const serialized = docs.map((d) => ({
      _id: d._id.toString(),
      itemNumber: d.itemNumber || "",
      itemName: d.itemName || "",
      itemDescription: d.itemDescription || "",
      uom: d.uom || "",
      tier1: d.tier1 ?? null,
      tier2: d.tier2 ?? null,
      tier3: d.tier3 ?? null,
      salePrice: d.salePrice ?? null,
      isTickmark: !!d.isTickmark,
      isRedLine: !!d.isRedLine,
      isPicture: !!d.isPicture,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    console.error("Failed to fetch BSPD Prices:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
});
