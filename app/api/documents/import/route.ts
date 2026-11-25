import { NextResponse } from "next/server";
import { convertUpload } from "@/lib/convert";
import { getDb } from "@/lib/db";
import { createDocument } from "@/lib/documents";
import { badRequest } from "@/lib/errors";
import { handler } from "@/lib/http";
import { requireApiUser } from "@/lib/session";

/** Multipart upload of a .txt/.md/.docx file -> new editable document owned by the caller. */
export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("Attach a file in the 'file' field.");

  const { title, html } = await convertUpload(file.name, Buffer.from(await file.arrayBuffer()));
  const doc = await createDocument(await getDb(), user.id, { title }, html);
  return NextResponse.json(doc, { status: 201 });
});
