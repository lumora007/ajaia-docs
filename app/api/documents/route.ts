import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createDocument, listDocuments } from "@/lib/documents";
import { handler, readJson } from "@/lib/http";
import { requireApiUser } from "@/lib/session";

export const GET = handler(async () => {
  const user = await requireApiUser();
  return NextResponse.json(await listDocuments(await getDb(), user.id));
});

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  const doc = await createDocument(await getDb(), user.id, await readJson(req));
  return NextResponse.json(doc, { status: 201 });
});
