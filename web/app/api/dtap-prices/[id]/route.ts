import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const DB_NAME = "DonoUtilities";
const COLLECTION = "DonoUtilities_DtapPrices";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    await db.collection(COLLECTION).updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
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
        },
      }
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update DTAP Price:", error);
    return NextResponse.json(
      { error: "Failed to update DTAP Price" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    await db.collection(COLLECTION).deleteOne({ _id: new ObjectId(id) });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete DTAP Price:", error);
    return NextResponse.json(
      { error: "Failed to delete DTAP Price" },
      { status: 500 }
    );
  }
}
