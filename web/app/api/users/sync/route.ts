import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { env } from "@/lib/env";
import { withAuth } from "@/lib/with-auth";

const DB_NAME = "DonoUtilities";
const USERS_COLLECTION = "DonoUtilities_Users";

export const POST = withAuth(async () => {
  try {
    const appId = env.APPSHEET_APP_ID;
    const accessKey = env.APPSHEET_ACCESS_KEY;
    const tableName = "Users";

    // Call AppSheet REST API
    const response = await fetch(
      `https://api.appsheet.com/api/v2/apps/${appId}/tables/${tableName}/Action`,
      {
        method: "POST",
        headers: {
          "applicationAccessKey": accessKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Action: "Find",
          Properties: {
            Locale: "en-US",
            Timezone: "UTC",
          },
          Rows: [],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AppSheet API returned error:", errorText);
      return NextResponse.json(
        { error: `AppSheet API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const rows = await response.json();

    if (!Array.isArray(rows)) {
      console.error("AppSheet response is not an array:", rows);
      return NextResponse.json(
        { error: "Invalid response format from AppSheet" },
        { status: 500 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Fetch teams to map AppSheet Team name to our teamId
    const TEAMS_COLLECTION = "DonoUtilities_Teams";
    const teams = await db.collection(TEAMS_COLLECTION).find({}).toArray();
    const teamNameToIdMap = new Map<string, string>();
    for (const team of teams) {
      const name = (team.team || team.name || "").toString().toLowerCase().trim();
      if (name) {
        teamNameToIdMap.set(name, team._id.toString());
      }
    }

    // Process and normalize the user rows
    const normalizedUsers = [];
    for (const row of rows) {
      // In AppSheet, key column is Email
      const email = row.Email;
      if (!email || typeof email !== "string" || !email.includes("@")) {
        // Skip invalid/missing emails
        continue;
      }

      // Explicit mapping: Name -> name, Role -> designation, Team -> teamId (mapped via DB team Name lookup)
      const name = row.Name || email.split("@")[0];
      const designation = row.Role || "";
      const teamNameInput = (row.Team || "").toString().toLowerCase().trim();
      const teamId = teamNameToIdMap.get(teamNameInput) || "";

      normalizedUsers.push({
        name,
        email: email.toLowerCase().trim(),
        designation,
        teamId,
      });
    }

    if (normalizedUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No valid user records found in AppSheet to sync.",
        syncedCount: 0,
      });
    }

    // Perform bulk upserts (ignoring other fields and not overwriting existing status)
    const bulkOps = normalizedUsers.map((user) => ({
      updateOne: {
        filter: { email: user.email },
        update: {
          $set: {
            name: user.name,
            designation: user.designation,
            teamId: user.teamId,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            status: "Active",
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    const result = await db.collection(USERS_COLLECTION).bulkWrite(bulkOps);

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${normalizedUsers.length} users.`,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount,
    });
  } catch (error) {
    console.error("Failed to sync users with AppSheet:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync users" },
      { status: 500 }
    );
  }
});
