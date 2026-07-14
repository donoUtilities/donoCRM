import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { withAuth } from "@/lib/with-auth";

const DB_NAME = "DonoUtilities";
const COLLECTION = "DonoUtilities_Splicing";
const PAGE_SIZE = 100;

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const skip = (page - 1) * PAGE_SIZE;

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const col = db.collection(COLLECTION);

    // Fetch primary splicing records
    const [docs, totalCount, users, teams, wireCenters, bspds, dtaps] = await Promise.all([
      col.find({}).sort({ _id: -1 }).skip(skip).limit(PAGE_SIZE).toArray(),
      col.countDocuments(),
      db.collection("DonoUtilities_Users").find({}, { projection: { name: 1 } }).toArray(),
      db.collection("DonoUtilities_Teams").find({}, { projection: { team: 1, name: 1 } }).toArray(),
      db.collection("DonoUtilities_WireCenter").find({}, { projection: { wireCenter: 1, name: 1 } }).toArray(),
      db.collection("DonoUtilities_Bspd").find({}, { projection: { feeder: 1 } }).toArray(),
      db.collection("DonoUtilities_Dtap").find({}, { projection: { dtapName: 1 } }).toArray(),
    ]);

    // Build lookup maps
    const userMap = new Map<string, string>();
    for (const u of users) userMap.set(u._id.toString(), u.name || "");

    const teamMap = new Map<string, string>();
    for (const t of teams) teamMap.set(t._id.toString(), t.team || t.name || "");

    const wcMap = new Map<string, string>();
    for (const w of wireCenters) wcMap.set(w._id.toString(), w.wireCenter || w.name || "");

    const bspdMap = new Map<string, string>();
    for (const b of bspds) bspdMap.set(b._id.toString(), b.feeder || "");

    const dtapMap = new Map<string, string>();
    for (const d of dtaps) dtapMap.set(d._id.toString(), d.dtapName || "");

    const serialized = docs.map((d) => {
      // Resolve feederSpliceTo array
      const spliceToNames: string[] = [];
      if (Array.isArray(d.feederSpliceTo)) {
        for (const ref of d.feederSpliceTo) {
          if (ref) {
            const name = bspdMap.get(ref.toString());
            if (name) spliceToNames.push(name);
          }
        }
      }

      return {
        _id: d._id.toString(),
        legacy_id: d.legacy_id || "",
        team: d.teamId ? teamMap.get(d.teamId.toString()) || "" : "",
        bspdORdtap: d.bspdORdtap || "",
        wireCenter: d.wireCenterId ? wcMap.get(d.wireCenterId.toString()) || "" : "",
        cableType: d.cableType || "",
        feeder: d.feeder ? bspdMap.get(d.feeder.toString()) || "" : "",
        feederSpliceTo: spliceToNames,
        dtap: d.dtap ? dtapMap.get(d.dtap.toString()) || "" : "",
        spliceSetupTeardownAerial: d.spliceSetupTeardownAerial ?? null,
        teardownAerialPicture: d.teardownAerialPicture || "",
        fiberFusionFibererial: d.fiberFusionFibererial ?? null,
        fiberFusionFibererialNumber: d.fiberFusionFibererialNumber ?? null,
        singleSplicePictures: d.singleSplicePictures || [],
        spliceTestFiberFusionRibbon: d.spliceTestFiberFusionRibbon ?? null,
        spliceTestFiberFusionRibbonNumber: d.spliceTestFiberFusionRibbonNumber ?? null,
        ribbonSplicePictures: d.ribbonSplicePictures || [],
        spliceTestFiberFusionPartialRibbon: d.spliceTestFiberFusionPartialRibbon ?? null,
        spliceTestFiberFusionPartialRibbonNumber: d.spliceTestFiberFusionPartialRibbonNumber ?? null,
        partialRibbonSplicePictures: d.partialRibbonSplicePictures || [],
        casePlacement: d.casePlacement || "",
        casePlacementPicture: d.casePlacementPicture || "",
        spliceDTAP: !!d.spliceDTAP,
        spliceDTAPPicture: d.spliceDTAPPicture || "",
        placeDTAPAerial: d.placeDTAPAerial || "",
        placeDTAPAerialPicture: d.placeDTAPAerialPicture || "",
        testDTAPPwrMtrOtdr: d.testDTAPPwrMtrOtdr || "",
        portPictures: d.portPictures || [],
        completedBy: d.completedBy ? userMap.get(d.completedBy.toString()) || "" : "",
        completedOn: d.completedOn || "",
        invoiceRequested: d.invoiceRequested || "",
        requestedOn: d.requestedOn || "",
      };
    });

    const response: Record<string, any> = {
      data: serialized,
      page,
      totalCount,
      totalPages: Math.ceil(totalCount / PAGE_SIZE),
    };

    if (page === 1) {
      const distinctTypes = await col.distinct("bspdORdtap");
      response.filterOptions = {
        teams: [...teamMap.values()].filter(Boolean).sort(),
        wireCenters: [...wcMap.values()].filter(Boolean).sort(),
        bspdORdtaps: distinctTypes.filter(Boolean).sort(),
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch Splicing Records:", error);
    return NextResponse.json(
      { error: "Failed to fetch Splicing Records" },
      { status: 500 }
    );
  }
});
