import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { withAuth } from "@/lib/with-auth";

const DB_NAME = "DonoUtilities";
const COLLECTION = "DonoUtilities_WireCenter";

export const GET = withAuth(async () => {
  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const docs = await db.collection(COLLECTION).find({}).toArray();

    const serialized = docs.map((d) => ({
      _id: d._id.toString(),
      name: d.wireCenter || d.name || "",
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Failed to fetch wire centers:", error);
    return NextResponse.json(
      { error: "Failed to fetch wire centers" },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request) => {
  try {
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

    const existing = await db
      .collection(COLLECTION)
      .findOne({ wireCenter: name });
    if (existing) {
      return NextResponse.json(
        { error: "A wire center with this name already exists" },
        { status: 409 }
      );
    }

    const result = await db.collection(COLLECTION).insertOne({
      wireCenter: name,
      createdAt: new Date(),
    });

    return NextResponse.json(
      { _id: result.insertedId.toString(), name },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create wire center:", error);
    return NextResponse.json(
      { error: "Failed to create wire center" },
      { status: 500 }
    );
  }
});
