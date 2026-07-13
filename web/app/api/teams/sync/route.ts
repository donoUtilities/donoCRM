import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { env } from "@/lib/env";
import { withAuth } from "@/lib/with-auth";

const DB_NAME = "DonoUtilities";
const TEAMS_COLLECTION = "DonoUtilities_Teams";

export const POST = withAuth(async () => {
  try {
    const appId = env.APPSHEET_APP_ID;
    const accessKey = env.APPSHEET_ACCESS_KEY;
    const tableName = "Teams";

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
      console.error("AppSheet API returned error for Teams:", errorText);
      return NextResponse.json(
        { error: `AppSheet API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const rows = await response.json();

    if (!Array.isArray(rows)) {
      console.error("AppSheet response is not an array for Teams:", rows);
      return NextResponse.json(
        { error: "Invalid response format from AppSheet" },
        { status: 500 }
      );
    }

    // Process and normalize the team rows
    const normalizedTeams = [];
    for (const row of rows) {
      const teamName = row.Team;
      if (!teamName || typeof teamName !== "string") {
        continue;
      }

      const tier = row.Tier || "";

      normalizedTeams.push({
        team: teamName.trim(),
        tier: typeof tier === "string" ? tier.trim() : String(tier).trim(),
      });
    }

    if (normalizedTeams.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No valid team records found in AppSheet to sync.",
        syncedCount: 0,
      });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Perform bulk upserts matching by team name
    const bulkOps = normalizedTeams.map((team) => ({
      updateOne: {
        filter: { team: team.team },
        update: {
          $set: {
            team: team.team,
            tier: team.tier,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    const result = await db.collection(TEAMS_COLLECTION).bulkWrite(bulkOps);

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${normalizedTeams.length} teams.`,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount,
    });
  } catch (error) {
    console.error("Failed to sync teams with AppSheet:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync teams" },
      { status: 500 }
    );
  }
});
