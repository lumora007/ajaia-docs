import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createSession, getUserBySession, SESSION_TTL_DAYS, type User } from "./auth";
import { getDb } from "./db";
import { unauthorized } from "./errors";

export const SESSION_COOKIE = "ajaia_session";

export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getUserBySession(await getDb(), token);
}

/** For route handlers: throws 401 if not signed in. */
export async function requireApiUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

/** For pages: redirects to /login if not signed in. */
export async function requirePageUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function startSession(res: NextResponse, userId: string): Promise<NextResponse> {
  const token = await createSession(await getDb(), userId);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
  return res;
}
