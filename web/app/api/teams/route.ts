import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { withAuth } from "@/lib/with-auth";

const DB_NAME = "DonoUtilities";
const COLLECTION = "DonoUtilities_Teams";

export const GET = withAuth(async () => {
  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const teams = await db.collection(COLLECTION).find({}).toArray();

    // Normalize: DB field is "team", frontend expects "name"
    const serialized = teams.map((t) => ({
      _id: t._id.toString(),
      name: t.team || t.name || "",
      tier: t.tier || "",
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Failed to fetch teams:", error);
    return NextResponse.json(
      { error: "Failed to fetch teams" },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request) => {
  try {
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

    const existing = await db.collection(COLLECTION).findOne({ team: name });
    if (existing) {
      return NextResponse.json(
        { error: "A team with this name already exists" },
        { status: 409 }
      );
    }

    const result = await db.collection(COLLECTION).insertOne({
      team: name,
      tier: tier || "",
      createdAt: new Date(),
    });

    return NextResponse.json(
      { _id: result.insertedId.toString(), name, tier },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create team:", error);
    return NextResponse.json(
      { error: "Failed to create team" },
      { status: 500 }
    );
  }
});
