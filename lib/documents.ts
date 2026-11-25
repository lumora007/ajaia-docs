import type { Db } from "./db";
import { badRequest, forbidden, notFound } from "./errors";
import { sanitizeDocHtml } from "./sanitize";
import { createDocSchema, shareSchema, updateDocSchema, uuidSchema, type ShareRole } from "./validation";

export type Role = "owner" | ShareRole;

export interface DocSummary {
  id: string;
  title: string;
  updatedAt: string;
  ownerName: string;
  role: Role;
}

export interface Doc extends DocSummary {
  contentHtml: string;
  ownerId: string;
}

export interface Share {
  userId: string;
  email: string;
  name: string;
  role: ShareRole;
}

const iso = (v: unknown) => new Date(v as string | Date).toISOString();

/** Single source of truth for permissions. Null = no access (or the doc doesn't exist). */
export async function getAccess(db: Db, userId: string, docId: string): Promise<Role | null> {
  if (!uuidSchema.safeParse(docId).success) return null;
  const [row] = await db.query<{ owner_id: string; role: ShareRole | null }>(
    `SELECT d.owner_id, s.role FROM documents d
     LEFT JOIN document_shares s ON s.document_id = d.id AND s.user_id = $2
     WHERE d.id = $1`,
    [docId, userId],
  );
  if (!row) return null;
  if (row.owner_id === userId) return "owner";
  return row.role;
}

/** 404 when there is no access (doesn't reveal existence); 403 when access exists but is insufficient. */
async function requireAccess(db: Db, userId: string, docId: string, needed: "read" | "write" | "owner"): Promise<Role> {
  const role = await getAccess(db, userId, docId);
  if (!role) throw notFound();
  if (needed === "write" && role === "viewer") throw forbidden("You have view-only access to this document.");
  if (needed === "owner" && role !== "owner") throw forbidden("Only the owner can do that.");
  return role;
}

export async function listDocuments(db: Db, userId: string): Promise<{ owned: DocSummary[]; shared: DocSummary[] }> {
  const rows = await db.query<{ id: string; title: string; updated_at: Date; owner_name: string; role: Role }>(
    `SELECT d.id, d.title, d.updated_at, u.name AS owner_name, 'owner' AS role
       FROM documents d JOIN users u ON u.id = d.owner_id WHERE d.owner_id = $1
     UNION ALL
     SELECT d.id, d.title, d.updated_at, u.name, s.role
       FROM document_shares s JOIN documents d ON d.id = s.document_id JOIN users u ON u.id = d.owner_id
      WHERE s.user_id = $1
     ORDER BY updated_at DESC`,
    [userId],
  );
  const docs = rows.map((r) => ({ id: r.id, title: r.title, updatedAt: iso(r.updated_at), ownerName: r.owner_name, role: r.role }));
  return { owned: docs.filter((d) => d.role === "owner"), shared: docs.filter((d) => d.role !== "owner") };
}

export async function createDocument(db: Db, userId: string, input: unknown, contentHtml = ""): Promise<{ id: string }> {
  const { title } = createDocSchema.parse(input ?? {});
  const [row] = await db.query<{ id: string }>(
    `INSERT INTO documents (owner_id, title, content_html) VALUES ($1, $2, $3) RETURNING id`,
    [userId, title ?? "Untitled document", sanitizeDocHtml(contentHtml)],
  );
  return row;
}

export async function getDocument(db: Db, userId: string, docId: string): Promise<Doc> {
  const role = await requireAccess(db, userId, docId, "read");
  const [r] = await db.query<{ id: string; title: string; content_html: string; updated_at: Date; owner_id: string; owner_name: string }>(
    `SELECT d.id, d.title, d.content_html, d.updated_at, d.owner_id, u.name AS owner_name
     FROM documents d JOIN users u ON u.id = d.owner_id WHERE d.id = $1`,
    [docId],
  );
  return {
    id: r.id,
    title: r.title,
    contentHtml: r.content_html,
    updatedAt: iso(r.updated_at),
    ownerId: r.owner_id,
    ownerName: r.owner_name,
    role,
  };
}

export async function updateDocument(
  db: Db,
  userId: string,
  docId: string,
  input: unknown,
): Promise<{ updatedAt: string; title: string }> {
  await requireAccess(db, userId, docId, "write");
  const { title, contentHtml } = updateDocSchema.parse(input);
  const [row] = await db.query<{ updated_at: Date; title: string }>(
    `UPDATE documents SET
       title = COALESCE($2, title),
       content_html = COALESCE($3, content_html),
       updated_at = now()
     WHERE id = $1 RETURNING updated_at, title`,
    [docId, title ?? null, contentHtml === undefined ? null : sanitizeDocHtml(contentHtml)],
  );
  return { updatedAt: iso(row.updated_at), title: row.title };
}

export async function deleteDocument(db: Db, userId: string, docId: string): Promise<void> {
  await requireAccess(db, userId, docId, "owner");
  await db.query(`DELETE FROM documents WHERE id = $1`, [docId]);
}

export async function listShares(db: Db, userId: string, docId: string): Promise<Share[]> {
  await requireAccess(db, userId, docId, "owner");
  return db.query<Share>(
    `SELECT u.id AS "userId", u.email, u.name, s.role FROM document_shares s
     JOIN users u ON u.id = s.user_id WHERE s.document_id = $1 ORDER BY s.created_at`,
    [docId],
  );
}

/** Grants (or changes) access. Sharing again with the same person updates their role. */
export async function shareDocument(db: Db, userId: string, docId: string, input: unknown): Promise<Share> {
  await requireAccess(db, userId, docId, "owner");
  const { email, role } = shareSchema.parse(input);
  const [target] = await db.query<{ id: string; email: string; name: string }>(
    `SELECT id, email, name FROM users WHERE email = $1`,
    [email],
  );
  if (!target) throw notFound(`No user found with email ${email}. They need to sign up first.`);
  if (target.id === userId) throw badRequest("You already own this document.");
  await db.query(
    `INSERT INTO document_shares (document_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (document_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [docId, target.id, role],
  );
  return { userId: target.id, email: target.email, name: target.name, role };
}

export async function removeShare(db: Db, userId: string, docId: string, targetUserId: string): Promise<void> {
  await requireAccess(db, userId, docId, "owner");
  if (!uuidSchema.safeParse(targetUserId).success) throw notFound("Share not found.");
  await db.query(`DELETE FROM document_shares WHERE document_id = $1 AND user_id = $2`, [docId, targetUserId]);
}
