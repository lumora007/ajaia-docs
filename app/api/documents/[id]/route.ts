import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deleteDocument, getDocument, updateDocument } from "@/lib/documents";
import { handler, readJson } from "@/lib/http";
import { requireApiUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  return NextResponse.json(await getDocument(await getDb(), user.id, (await params).id));
});

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  return NextResponse.json(await updateDocument(await getDb(), user.id, (await params).id, await readJson(req)));
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  await deleteDocument(await getDb(), user.id, (await params).id);
  return new NextResponse(null, { status: 204 });
});
