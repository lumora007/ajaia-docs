import { NextResponse } from "next/server";
import { login } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { handler, readJson } from "@/lib/http";
import { startSession } from "@/lib/session";

export const POST = handler(async (req: Request) => {
  const user = await login(await getDb(), await readJson(req));
  return startSession(NextResponse.json({ user }), user.id);
});
