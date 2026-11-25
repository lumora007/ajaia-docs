import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import type { Db } from "./db";
import { conflict, unauthorized } from "./errors";
import { loginSchema, signupSchema } from "./validation";

export interface User {
  id: string;
  email: string;
  name: string;
}

export const SESSION_TTL_DAYS = 30;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function signup(db: Db, input: unknown): Promise<User> {
  const { name, email, password } = signupSchema.parse(input);
  const hash = await bcrypt.hash(password, 10);
  const rows = await db.query<User>(
    `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING RETURNING id, email, name`,
    [email, name, hash],
  );
  if (rows.length === 0) throw conflict("An account with that email already exists.");
  return rows[0];
}

export async function login(db: Db, input: unknown): Promise<User> {
  const { email, password } = loginSchema.parse(input);
  const [row] = await db.query<User & { password_hash: string }>(
    `SELECT id, email, name, password_hash FROM users WHERE email = $1`,
    [email],
  );
  // Same message for unknown email and wrong password, so accounts can't be enumerated.
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    throw unauthorized("Incorrect email or password.");
  }
  return { id: row.id, email: row.email, name: row.name };
}

/** Returns the raw token for the cookie; only its SHA-256 hash is stored. */
export async function createSession(db: Db, userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(days => $3::int))`,
    [hashToken(token), userId, SESSION_TTL_DAYS],
  );
  return token;
}

export async function getUserBySession(db: Db, token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const [user] = await db.query<User>(
    `SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  return user ?? null;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.query(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]);
}
