import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";

type Handler = (
  req: NextRequest,
  ctx: { session: Session }
) => Promise<Response>;

export function withAuth(handler: Handler) {
  return async (req: NextRequest): Promise<Response> => {
    const session = await auth();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return handler(req, { session });
  };
}
