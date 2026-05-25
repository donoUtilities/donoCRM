import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const DB_NAME = "DonoUtilities";
const COLLECTION = "DonoUtilities_WireCenter";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Wire center name is required" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const result = await db.collection(COLLECTION).updateOne(
      { _id: new ObjectId(id) },
      { $set: { wireCenter: name, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Wire center not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update wire center:", error);
    return NextResponse.json(
      { error: "Failed to update wire center" },
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

    const result = await db
      .collection(COLLECTION)
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Wire center not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete wire center:", error);
    return NextResponse.json(
      { error: "Failed to delete wire center" },
      { status: 500 }
    );
  }
}
