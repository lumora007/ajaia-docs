import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { handler } from "@/lib/http";
import { SESSION_COOKIE } from "@/lib/session";

export const POST = handler(async () => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(await getDb(), token);
  store.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
});
