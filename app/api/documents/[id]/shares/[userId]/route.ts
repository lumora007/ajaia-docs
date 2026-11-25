import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { removeShare } from "@/lib/documents";
import { handler } from "@/lib/http";
import { requireApiUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string; userId: string }> };

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id, userId } = await params;
  await removeShare(await getDb(), user.id, id, userId);
  return new NextResponse(null, { status: 204 });
});
