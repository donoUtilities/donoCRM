import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const DB_NAME = "DonoUtilities";
const DTAP_COLLECTION = "DonoUtilities_Dtap";
const DTAP_RECORDS_COLLECTION = "DonoUtilities_DtapRecords";
const TEAMS_COLLECTION = "DonoUtilities_Teams";
const WC_COLLECTION = "DonoUtilities_WireCenter";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const dtap = await db
      .collection(DTAP_COLLECTION)
      .findOne({ _id: new ObjectId(id) });

    if (!dtap) {
      return NextResponse.json({ error: "DTAP not found" }, { status: 404 });
    }

    // Fetch related records + invoices
    const [records, teams, wireCenters, invoices] = await Promise.all([
      db
        .collection(DTAP_RECORDS_COLLECTION)
        .find({ dtapId: new ObjectId(id) })
        .toArray(),
      db.collection(TEAMS_COLLECTION).find({}, { projection: { team: 1, name: 1 } }).toArray(),
      db.collection(WC_COLLECTION).find({}, { projection: { wireCenter: 1, name: 1 } }).toArray(),
      db
        .collection("DonoUtilities_DtapInvoices")
        .find({ dtapId: new ObjectId(id) })
        .toArray(),
    ]);

    // Build lookup maps
    const teamMap = new Map<string, string>();
    for (const t of teams) {
      teamMap.set(t._id.toString(), t.team || t.name || "");
    }
    const wcMap = new Map<string, string>();
    for (const w of wireCenters) {
      wcMap.set(w._id.toString(), w.wireCenter || w.name || "");
    }

    // Build invoice lookup: recordId -> invoice info
    const invoiceMap = new Map<
      string,
      { invoiceNumber: string; date: string; isPaid: boolean; week: string }
    >();
    for (const inv of invoices) {
      const info = {
        invoiceNumber: inv.invoiceNumber || "",
        date: inv.date || "",
        isPaid: !!inv.isPaid,
        week: inv.week || "",
      };
      if (Array.isArray(inv.dtapItemsIds)) {
        for (const itemId of inv.dtapItemsIds) {
          invoiceMap.set(itemId.toString(), info);
        }
      }
    }

    const teamIdStr = dtap.teamId ? dtap.teamId.toString() : "";
    const wcIdStr = dtap.wireCenterId ? dtap.wireCenterId.toString() : "";

    const serializedDtap = {
      _id: dtap._id.toString(),
      dtap: dtap.dtap || "",
      wireCenterId: wcIdStr,
      wireCenterName: wcMap.get(wcIdStr) || "",
      teamId: teamIdStr,
      teamName: teamMap.get(teamIdStr) || "",
      completionStatus: dtap.completionStatus || "",
      testingStatus: dtap.testingStatus || "",
      requestedTimeStamp: dtap.requestedTimeStamp || "",
      invoiceStatus: dtap.invoiceStatus || "",
    };

    const serializedRecords = records.map((r) => {
      const rId = r._id.toString();
      const inv = invoiceMap.get(rId) || null;
      return {
        _id: rId,
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
        isInvoice: !!inv,
        invoiceInfo: inv,
      };
    });

    return NextResponse.json({
      dtap: serializedDtap,
      records: serializedRecords,
    });
  } catch (error) {
    console.error("Failed to fetch DTAP detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch DTAP detail" },
      { status: 500 }
    );
  }
}
