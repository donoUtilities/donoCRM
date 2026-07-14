import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { withAuth } from "@/lib/with-auth";

const DB_NAME = "DonoUtilities";
const COLLECTION = "DonoUtilities_SplicingInvoices";
const PAGE_SIZE = 100;

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const skip = (page - 1) * PAGE_SIZE;

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const col = db.collection(COLLECTION);

    const [docs, totalCount, splicingItems, teams] = await Promise.all([
      col.find({}).sort({ _id: -1 }).skip(skip).limit(PAGE_SIZE).toArray(),
      col.countDocuments(),
      db.collection("DonoUtilities_Splicing").find({}, { projection: { legacy_id: 1 } }).toArray(),
      db.collection("DonoUtilities_Teams").find({}, { projection: { team: 1, name: 1 } }).toArray(),
    ]);

    // Build lookup maps
    const teamMap = new Map<string, string>();
    for (const t of teams) teamMap.set(t._id.toString(), t.team || t.name || "");

    const spliceItemMap = new Map<string, string>();
    for (const item of splicingItems) spliceItemMap.set(item._id.toString(), item.legacy_id || "");

    const serialized = docs.map((d) => {
      // Resolve spliceItems array to legacy_id string list
      const itemKeys: string[] = [];
      if (Array.isArray(d.spliceItems)) {
        for (const ref of d.spliceItems) {
          if (ref) {
            const key = spliceItemMap.get(ref.toString());
            if (key) itemKeys.push(key);
          }
        }
      }

      return {
        _id: d._id.toString(),
        legacy_id: d.legacy_id || "",
        invoiceNumber: d.invoiceNumber || "",
        date: d.date || "",
        bspdORDtap: d.bspdORDtap || "",
        spliceItems: itemKeys,
        spliceItemsCount: itemKeys.length,
        team: d.team ? teamMap.get(d.team.toString()) || "" : "",
        isPaid: !!d.isPaid,
        createdOn: d.createdOn || "",
      };
    });

    const response: Record<string, any> = {
      data: serialized,
      page,
      totalCount,
      totalPages: Math.ceil(totalCount / PAGE_SIZE),
    };

    if (page === 1) {
      const distinctTypes = await col.distinct("bspdORDtap");
      response.filterOptions = {
        teams: [...teamMap.values()].filter(Boolean).sort(),
        bspdORDtaps: distinctTypes.filter(Boolean).sort(),
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch Splicing Invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch Splicing Invoices" },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const result = await db.collection(COLLECTION).insertOne(body);
    return NextResponse.json({
      _id: result.insertedId.toString(),
      ...body,
    });
  } catch (error) {
    console.error("Failed to create Splicing Invoice:", error);
    return NextResponse.json(
      { error: "Failed to create Splicing Invoice" },
      { status: 500 }
    );
  }
});
