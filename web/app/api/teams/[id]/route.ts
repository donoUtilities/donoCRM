import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const DB_NAME = "DonoUtilities";
const COLLECTION = "DonoUtilities_Teams";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, tier } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Team name is required" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const result = await db.collection(COLLECTION).updateOne(
      { _id: new ObjectId(id) },
      { $set: { team: name, tier: tier || "", updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update team:", error);
    return NextResponse.json(
      { error: "Failed to update team" },
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
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete team:", error);
    return NextResponse.json(
      { error: "Failed to delete team" },
      { status: 500 }
    );
  }
}
