import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { withAuth } from "@/lib/with-auth";

const DB_NAME = "DonoUtilities";
const PAGE_SIZE = 100;

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const skip = (page - 1) * PAGE_SIZE;

    // ── Server-side filter params ──
    const filterPayment = searchParams.get("payment") || "all";
    const filterWireCenter = searchParams.get("wireCenter") || "all";
    const filterDtap = searchParams.get("dtap") || "all";
    const filterTeam = searchParams.get("team") || "all";
    const filterWeek = searchParams.get("week") || "all";
    const searchQuery = searchParams.get("q") || "";

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const invCol = db.collection("DonoUtilities_DtapInvoices");

    // ── Build server-side $match conditions ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matchConditions: Record<string, any> = {};
    if (filterPayment !== "all") {
      matchConditions.isPaid = filterPayment === "Paid";
    }
    if (filterWireCenter !== "all") {
      matchConditions.wireCenterName = filterWireCenter;
    }
    if (filterDtap !== "all") {
      matchConditions.dtapName = filterDtap;
    }
    if (filterTeam !== "all") {
      matchConditions.teamName = filterTeam;
    }
    if (filterWeek !== "all") {
      matchConditions.week = filterWeek;
    }
    if (searchQuery.trim()) {
      const escaped = searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      matchConditions.$or = [
        { invoiceNumber: { $regex: escaped, $options: "i" } },
        { week: { $regex: escaped, $options: "i" } },
        { dtapName: { $regex: escaped, $options: "i" } },
        { teamName: { $regex: escaped, $options: "i" } },
        { wireCenterName: { $regex: escaped, $options: "i" } },
      ];
    }

    const hasFilters = Object.keys(matchConditions).length > 0;

    // ── Single aggregation pipeline: joins + inline totals + pagination ──
    const pipeline = [
      { $sort: { _id: -1 as const } },

      // Join DTAP parent
      {
        $lookup: {
          from: "DonoUtilities_Dtap",
          localField: "dtapId",
          foreignField: "_id",
          as: "dtap",
        },
      },
      { $unwind: { path: "$dtap", preserveNullAndEmptyArrays: true } },

      // Join Team (through dtap.teamId)
      {
        $lookup: {
          from: "DonoUtilities_Teams",
          localField: "dtap.teamId",
          foreignField: "_id",
          as: "team",
        },
      },
      { $unwind: { path: "$team", preserveNullAndEmptyArrays: true } },

      // Join Wire Center (through dtap.wireCenterId)
      {
        $lookup: {
          from: "DonoUtilities_WireCenter",
          localField: "dtap.wireCenterId",
          foreignField: "_id",
          as: "wireCenter",
        },
      },
      { $unwind: { path: "$wireCenter", preserveNullAndEmptyArrays: true } },

      // Join DtapRecords to compute invoice totals inline
      {
        $lookup: {
          from: "DonoUtilities_DtapRecords",
          localField: "dtapItemsIds",
          foreignField: "_id",
          as: "items",
        },
      },

      // Compute totals + project final shape
      {
        $project: {
          invoiceNumber: { $ifNull: ["$invoiceNumber", ""] },
          week: { $ifNull: ["$week", ""] },
          dtapName: { $ifNull: ["$dtap.dtap", ""] },
          teamName: {
            $ifNull: [
              "$team.team",
              { $ifNull: ["$team.name", ""] },
            ],
          },
          wireCenterName: {
            $ifNull: [
              "$wireCenter.wireCenter",
              { $ifNull: ["$wireCenter.name", ""] },
            ],
          },
          isPaid: { $ifNull: ["$isPaid", false] },
          adminInvoice: { $ifNull: ["$adminInvoice", ""] },
          teamInvoice: { $ifNull: ["$teamInvoice", ""] },
          adminInvoiceTotal: {
            $reduce: {
              input: "$items",
              initialValue: 0,
              in: { $add: ["$$value", { $toDouble: { $ifNull: ["$$this.saleValue", 0] } }] },
            },
          },
          teamInvoiceTotal: {
            $reduce: {
              input: "$items",
              initialValue: 0,
              in: { $add: ["$$value", { $toDouble: { $ifNull: ["$$this.totalValue", 0] } }] },
            },
          },
          createdOn: { $ifNull: ["$createdOn", { $ifNull: ["$date", ""] }] },
          dtapItemsIds: { $ifNull: ["$dtapItemsIds", []] },
        },
      },

      // ── Server-side filter $match (applied after $project on the full collection) ──
      ...(hasFilters ? [{ $match: matchConditions }] : []),

      // $facet: get paginated data + total count in a single pass
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: PAGE_SIZE }],
          totalCount: [{ $count: "count" }],
        },
      },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [aggregationResult] = await invCol.aggregate(pipeline).toArray() as any[];

    const data = aggregationResult?.data || [];
    const totalCount = aggregationResult?.totalCount?.[0]?.count || 0;
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    // Stringify _id for JSON serialization
    const serialized = data.map((doc: Record<string, unknown>) => ({
      ...doc,
      _id: String(doc._id),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: Record<string, any> = {
      data: serialized,
      page,
      totalCount,
      totalPages,
    };

    // ── Filter options: lightweight queries only on page 1 ──
    if (page === 1) {
      // Run filter-option queries in parallel (small, indexed lookups)
      const [weeks, dtaps, teams, wireCenters] = await Promise.all([
        invCol.distinct("week"),
        db.collection("DonoUtilities_Dtap").distinct("dtap"),
        db.collection("DonoUtilities_Teams")
          .find({}, { projection: { team: 1, name: 1 } })
          .toArray(),
        db.collection("DonoUtilities_WireCenter")
          .find({}, { projection: { wireCenter: 1, name: 1 } })
          .toArray(),
      ]);

      const teamNames = teams
        .map((t) => t.team || t.name || "")
        .filter(Boolean)
        .sort();
      const wcNames = wireCenters
        .map((w) => w.wireCenter || w.name || "")
        .filter(Boolean)
        .sort();

      response.filterOptions = {
        payments: ["Paid", "Unpaid"],
        wireCenters: wcNames,
        dtaps: (dtaps as string[]).filter(Boolean).sort(),
        teams: teamNames,
        weeks: (weeks as string[]).filter(Boolean).sort((a, b) => {
          const [ya, wa] = a.split("-").map(Number);
          const [yb, wb] = b.split("-").map(Number);
          return yb - ya || wb - wa;
        }),
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch DTAP Invoices:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
});
