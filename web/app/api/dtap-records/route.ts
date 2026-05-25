import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { withAuth } from "@/lib/with-auth";

const DB_NAME = "DonoUtilities";
const PAGE_SIZE = 100;

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const skip = (page - 1) * PAGE_SIZE;
    const invoiceId = searchParams.get("invoiceId");

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const recCol = db.collection("DonoUtilities_DtapRecords");

    // ── If filtering by invoiceId, resolve the record IDs first ──
    let matchStage: Record<string, unknown> = {};
    if (invoiceId) {
      const invoice = await db
        .collection("DonoUtilities_DtapInvoices")
        .findOne({ _id: new ObjectId(invoiceId) });
      if (invoice && Array.isArray(invoice.dtapItemsIds)) {
        const ids = invoice.dtapItemsIds.map(
          (id: { toString(): string }) => new ObjectId(id.toString())
        );
        matchStage = { _id: { $in: ids } };
      } else {
        // No matching records — return empty
        return NextResponse.json({
          data: [],
          page,
          pageSize: PAGE_SIZE,
          totalCount: 0,
          totalPages: 0,
        });
      }
    }

    // ── Single aggregation pipeline with $lookup joins ──
    const pipeline: Record<string, unknown>[] = [];

    // Apply invoiceId filter if present
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    pipeline.push(
      // Join DTAP parent
      {
        $lookup: {
          from: "DonoUtilities_Dtap",
          localField: "dtapId",
          foreignField: "_id",
          as: "dtapDoc",
        },
      },
      { $unwind: { path: "$dtapDoc", preserveNullAndEmptyArrays: true } },

      // Join Team (through dtap.teamId)
      {
        $lookup: {
          from: "DonoUtilities_Teams",
          localField: "dtapDoc.teamId",
          foreignField: "_id",
          as: "teamDoc",
        },
      },
      { $unwind: { path: "$teamDoc", preserveNullAndEmptyArrays: true } },

      // Join Wire Center (through dtap.wireCenterId)
      {
        $lookup: {
          from: "DonoUtilities_WireCenter",
          localField: "dtapDoc.wireCenterId",
          foreignField: "_id",
          as: "wcDoc",
        },
      },
      { $unwind: { path: "$wcDoc", preserveNullAndEmptyArrays: true } },

      // Reverse-lookup: find the invoice that contains this record's _id in its dtapItemsIds
      {
        $lookup: {
          from: "DonoUtilities_DtapInvoices",
          localField: "_id",
          foreignField: "dtapItemsIds",
          as: "invoiceDoc",
        },
      },
      { $unwind: { path: "$invoiceDoc", preserveNullAndEmptyArrays: true } },

      // Project the final shape
      {
        $addFields: {
          dtapName: { $ifNull: ["$dtapDoc.dtap", ""] },
          teamName: {
            $ifNull: ["$teamDoc.team", { $ifNull: ["$teamDoc.name", ""] }],
          },
          wireCenterName: {
            $ifNull: ["$wcDoc.wireCenter", { $ifNull: ["$wcDoc.name", ""] }],
          },
          isInvoice: { $cond: [{ $ifNull: ["$invoiceDoc", false] }, true, false] },
          invoiceInfo: {
            $cond: [
              { $ifNull: ["$invoiceDoc", false] },
              {
                invoiceNumber: { $ifNull: ["$invoiceDoc.invoiceNumber", ""] },
                date: { $ifNull: ["$invoiceDoc.date", ""] },
                isPaid: { $ifNull: ["$invoiceDoc.isPaid", false] },
                week: { $ifNull: ["$invoiceDoc.week", ""] },
              },
              null,
            ],
          },
        },
      },

      // Remove joined docs from output
      { $project: { dtapDoc: 0, teamDoc: 0, wcDoc: 0, invoiceDoc: 0 } }
    );

    // ── Use $facet for count + paginated data ──
    if (invoiceId) {
      // When filtering by invoice, return ALL matching records (no pagination)
      pipeline.push({
        $facet: {
          data: [],
          totalCount: [{ $count: "count" }],
        },
      });
    } else {
      pipeline.push({
        $facet: {
          data: [{ $sort: { _id: -1 } }, { $skip: skip }, { $limit: PAGE_SIZE }],
          totalCount: [{ $count: "count" }],
        },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [result] = (await recCol.aggregate(pipeline).toArray()) as any[];
    const data = result?.data || [];
    const totalCount = result?.totalCount?.[0]?.count || 0;

    // Serialize _id and clean up fields
    const serialized = data.map((r: Record<string, unknown>) => ({
      _id: String(r._id),
      dtapName: r.dtapName || "",
      wireCenterName: r.wireCenterName || "",
      teamName: r.teamName || "",
      terminalRun: r.terminalRun,
      jumperFootage: r.jumperFootage,
      aerialPrimary: r.aerialPrimary,
      aerialAdditional: r.aerialAdditional,
      undergroundPrimary: r.undergroundPrimary,
      undergroundAdditional: r.undergroundAdditional,
      terminalName: r.terminalName || "",
      termPortAndPower: r.termPortAndPower || "",
      termPlacement: r.termPlacement || "",
      build: r.build || "",
      servedHouseholds: r.servedHouseholds,
      aerialPrimaryPercent: r.aerialPrimaryPercent || "",
      aerialAdditionalPercent: r.aerialAdditionalPercent || "",
      ugPrimaryPercent: r.ugPrimaryPercent || "",
      ugAdditionalPercent: r.ugAdditionalPercent || "",
      aerialPrimaryValue: r.aerialPrimaryValue,
      aerialAdditionalValue: r.aerialAdditionalValue,
      ugPrimaryValue: r.ugPrimaryValue,
      ugAdditionalValue: r.ugAdditionalValue,
      aerialPrimarySaleValue: r.aerialPrimarySaleValue,
      aerialAdditionalSaleValue: r.aerialAdditionalSaleValue,
      ugPrimarySaleValue: r.ugPrimarySaleValue,
      ugAdditionalSaleValue: r.ugAdditionalSaleValue,
      placedPrice: r.placedPrice,
      placedSalePrice: r.placedSalePrice,
      testedPrice: r.testedPrice,
      testedSalePrice: r.testedSalePrice,
      totalValue: r.totalValue,
      saleValue: r.saleValue,
      terminalPlaced: r.terminalPlaced,
      terminalPlacedDate: r.terminalPlacedDate || "",
      terminalPlacedPicture: r.terminalPlacedPicture || "",
      terminalTested: r.terminalTested,
      lightLevel: r.lightLevel,
      terminalTestedPicture: r.terminalTestedPicture || "",
      terminalTestedDate: r.terminalTestedDate || "",
      comments: r.comments || "",
      aerialPrimaryPriceTeam: r.aerialPrimaryPriceTeam,
      aerialPrimaryPriceAdmin: r.aerialPrimaryPriceAdmin,
      aerialAdditionalPriceTeam: r.aerialAdditionalPriceTeam,
      aerialAdditionalPriceAdmin: r.aerialAdditionalPriceAdmin,
      ugPrimaryPriceTeam: r.ugPrimaryPriceTeam,
      ugPrimaryPriceAdmin: r.ugPrimaryPriceAdmin,
      ugAdditionalPriceTeam: r.ugAdditionalPriceTeam,
      ugAdditionalPriceAdmin: r.ugAdditionalPriceAdmin,
      taskStatus: r.taskStatus || "",
      isInvoice: r.isInvoice,
      invoiceInfo: r.invoiceInfo || null,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: Record<string, any> = {
      data: serialized,
      page,
      pageSize: PAGE_SIZE,
      totalCount,
      totalPages: Math.ceil(totalCount / PAGE_SIZE),
    };

    // ── Filter options: lightweight distinct queries on page 1 only ──
    if (page === 1) {
      const [taskStatuses, dtapNames, teams, wireCenters] = await Promise.all([
        recCol.distinct("taskStatus"),
        db.collection("DonoUtilities_Dtap").distinct("dtap"),
        db
          .collection("DonoUtilities_Teams")
          .find({}, { projection: { team: 1, name: 1 } })
          .toArray(),
        db
          .collection("DonoUtilities_WireCenter")
          .find({}, { projection: { wireCenter: 1, name: 1 } })
          .toArray(),
      ]);

      response.filterOptions = {
        dtaps: (dtapNames as string[]).filter(Boolean).sort(),
        wireCenters: wireCenters
          .map((w) => w.wireCenter || w.name || "")
          .filter(Boolean)
          .sort(),
        teams: teams
          .map((t) => t.team || t.name || "")
          .filter(Boolean)
          .sort(),
        taskStatuses: (taskStatuses as string[]).filter(Boolean).sort(),
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch DTAP Records:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
});
