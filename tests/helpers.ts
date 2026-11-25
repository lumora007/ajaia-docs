import { login, type User } from "@/lib/auth";
import { pgliteDb, type Db } from "@/lib/db";
import { DEMO_PASSWORD, migrate } from "@/lib/schema";

/** Fresh in-memory Postgres with schema + seed data, plus the three demo users. */
export async function setup(): Promise<{ db: Db; alice: User; bob: User; carol: User }> {
  const db = await pgliteDb();
  await migrate(db.query);
  const as = (email: string) => login(db, { email, password: DEMO_PASSWORD });
  return { db, alice: await as("alice@ajaia.test"), bob: await as("bob@ajaia.test"), carol: await as("carol@ajaia.test") };
}

/** Runs a promise expected to fail and returns the AppError status. */
export async function statusOf(p: Promise<unknown>): Promise<number> {
  try {
    await p;
  } catch (err) {
    return (err as { status?: number }).status ?? (err instanceof Error && err.name === "ZodError" ? 400 : -1);
  }
  throw new Error("Expected promise to reject");
}
