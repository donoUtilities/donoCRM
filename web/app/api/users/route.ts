import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const DB_NAME = "DonoUtilities";
const USERS_COLLECTION = "DonoUtilities_Users";
const TEAMS_COLLECTION = "DonoUtilities_Teams";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const [users, teams] = await Promise.all([
      db.collection(USERS_COLLECTION).find({}).toArray(),
      db.collection(TEAMS_COLLECTION).find({}).toArray(),
    ]);

    // Build a teamId -> { name, tier } lookup map
    const teamMap = new Map<string, { name: string; tier: string }>();
    for (const team of teams) {
      teamMap.set(team._id.toString(), {
        name: team.team || team.name || "",
        tier: team.tier || "",
      });
    }

    const serialized = users.map((user) => {
      const teamIdStr = user.teamId ? user.teamId.toString() : null;
      const team = teamIdStr ? teamMap.get(teamIdStr) : null;
      return {
        ...user,
        _id: user._id.toString(),
        teamId: teamIdStr,
        teamName: team?.name || null,
        teamTier: team?.tier || null,
      };
    });

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, designation, status, teamId } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const existing = await db.collection(USERS_COLLECTION).findOne({ email });
    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    const result = await db.collection(USERS_COLLECTION).insertOne({
      name,
      email,
      designation: designation || "",
      status: status || "Active",
      teamId: teamId || "",
      createdAt: new Date(),
    });

    return NextResponse.json(
      { _id: result.insertedId.toString(), name, email, designation, status, teamId },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
