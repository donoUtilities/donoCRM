import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const DB_NAME = "DonoUtilities";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Fetch the parent BSPD item
    const bspd = await db
      .collection("DonoUtilities_Bspd")
      .findOne({ _id: new ObjectId(id) });

    if (!bspd) {
      return NextResponse.json({ error: "BSPD not found" }, { status: 404 });
    }

    // Fetch related BspdItems where feederId matches this BSPD's _id
    const [items, users, teams, wireCenters] = await Promise.all([
      db.collection("DonoUtilities_BspdItems")
        .find({ feederId: new ObjectId(id) })
        .toArray(),
      db.collection("DonoUtilities_Users")
        .find({}, { projection: { name: 1 } })
        .toArray(),
      db.collection("DonoUtilities_Teams")
        .find({}, { projection: { team: 1, name: 1 } })
        .toArray(),
      db.collection("DonoUtilities_WireCenter")
        .find({}, { projection: { wireCenter: 1, name: 1 } })
        .toArray(),
    ]);

    // Build lookup maps
    const userMap = new Map<string, string>();
    for (const u of users) userMap.set(u._id.toString(), u.name || "");
    const teamMap = new Map<string, string>();
    for (const t of teams) teamMap.set(t._id.toString(), t.team || t.name || "");
    const wcMap = new Map<string, string>();
    for (const w of wireCenters) wcMap.set(w._id.toString(), w.wireCenter || w.name || "");

    // Resolve parent BSPD info
    const wcRef = bspd.wireCenterId || bspd.wireCenter;
    const teamRef = bspd.teamId || bspd.team;
    const bspdInfo = {
      _id: bspd._id.toString(),
      feeder: bspd.feeder || "",
      wireCenter: wcRef ? wcMap.get(wcRef.toString()) || "" : "",
      cableType: bspd.cableType || "",
      totalFT: bspd.totalFT ?? null,
      team: teamRef ? teamMap.get(teamRef.toString()) || "" : "",
      BSPDCompleteInFull: bspd.BSPDCompleteInFull ?? null,
      completionDate: bspd.completionDate || "",
      invoiceStatus: bspd.invoiceStatus || "",
    };

    // Serialize items
    const serializedItems = items.map((d) => ({
      _id: d._id.toString(),
      item: d.item || "",
      itemDescription: d.itemDescription || "",
      actualFT: d.actualFT ?? null,
      uom: d.uom || "",
      tickMarkStart: d.tickMarkStart ?? null,
      tickMarkStartPicture: d.tickMarkStartPicture || "",
      tickMarkEnd: d.tickMarkEnd ?? null,
      tickMarkEndPicture: d.tickMarkEndPicture || "",
      redLines: d.redLines || "",
      workProcesPicture: d.workProcesPicture || "",
      additionalPicture: d.additionalPicture || "",
      price: d.price ?? null,
      salePrice: d.salePrice ?? null,
      completedBy: d.completedBy ? userMap.get(d.completedBy.toString()) || "" : "",
      completedAt: d.completedAt || "",
    }));

    return NextResponse.json({
      bspd: bspdInfo,
      data: serializedItems,
      page: 1,
      totalCount: serializedItems.length,
      totalPages: 1,
    });
  } catch (error) {
    console.error("Failed to fetch BSPD detail:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
