import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { listShares, shareDocument } from "@/lib/documents";
import { handler, readJson } from "@/lib/http";
import { requireApiUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  return NextResponse.json(await listShares(await getDb(), user.id, (await params).id));
});

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const share = await shareDocument(await getDb(), user.id, (await params).id, await readJson(req));
  return NextResponse.json(share, { status: 201 });
});
