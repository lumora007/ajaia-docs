import { beforeEach, describe, expect, it } from "vitest";
import type { User } from "@/lib/auth";
import type { Db } from "@/lib/db";
import {
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  listShares,
  removeShare,
  shareDocument,
  updateDocument,
} from "@/lib/documents";
import { setup, statusOf } from "./helpers";

describe("sharing and access control", () => {
  let db: Db, alice: User, bob: User, carol: User, docId: string;

  beforeEach(async () => {
    ({ db, alice, bob, carol } = await setup());
    docId = (await createDocument(db, alice.id, { title: "Q3 plan" }, "<p>secret</p>")).id;
  });

  it("hides a private document from other users as 404 (no existence leak)", async () => {
    expect(await statusOf(getDocument(db, bob.id, docId))).toBe(404);
    expect(await statusOf(updateDocument(db, bob.id, docId, { title: "hijack" }))).toBe(404);
    expect((await listDocuments(db, bob.id)).shared.map((d) => d.id)).not.toContain(docId);
  });

  it("viewer can read but not edit, and sees the doc under 'shared'", async () => {
    await shareDocument(db, alice.id, docId, { email: "BOB@ajaia.test ", role: "viewer" });

    const doc = await getDocument(db, bob.id, docId);
    expect(doc.role).toBe("viewer");
    expect(doc.contentHtml).toBe("<p>secret</p>");
    expect(await statusOf(updateDocument(db, bob.id, docId, { contentHtml: "<p>edit</p>" }))).toBe(403);

    const bobDocs = await listDocuments(db, bob.id);
    expect(bobDocs.shared.find((d) => d.id === docId)).toMatchObject({ role: "viewer", ownerName: "Alice Chen" });
    expect(bobDocs.owned.map((d) => d.id)).not.toContain(docId);
  });

  it("upgrading to editor lets the collaborator save, and the owner sees the change", async () => {
    await shareDocument(db, alice.id, docId, { email: "bob@ajaia.test", role: "viewer" });
    await shareDocument(db, alice.id, docId, { email: "bob@ajaia.test", role: "editor" });
    expect(await listShares(db, alice.id, docId)).toHaveLength(1);

    await updateDocument(db, bob.id, docId, { contentHtml: "<p>Bob was here</p>" });
    expect((await getDocument(db, alice.id, docId)).contentHtml).toBe("<p>Bob was here</p>");
  });

  it("only the owner can share, unshare or delete", async () => {
    await shareDocument(db, alice.id, docId, { email: "bob@ajaia.test", role: "editor" });
    expect(await statusOf(shareDocument(db, bob.id, docId, { email: "carol@ajaia.test", role: "editor" }))).toBe(403);
    expect(await statusOf(removeShare(db, bob.id, docId, bob.id))).toBe(403);
    expect(await statusOf(deleteDocument(db, bob.id, docId))).toBe(403);
    expect(await statusOf(getDocument(db, carol.id, docId))).toBe(404);
  });

  it("revoking a share removes access immediately", async () => {
    await shareDocument(db, alice.id, docId, { email: "bob@ajaia.test", role: "editor" });
    await removeShare(db, alice.id, docId, bob.id);
    expect(await statusOf(getDocument(db, bob.id, docId))).toBe(404);
  });

  it("rejects sharing with unknown users, yourself, or an invalid role", async () => {
    expect(await statusOf(shareDocument(db, alice.id, docId, { email: "nobody@x.test", role: "viewer" }))).toBe(404);
    expect(await statusOf(shareDocument(db, alice.id, docId, { email: "alice@ajaia.test", role: "viewer" }))).toBe(400);
    expect(await statusOf(shareDocument(db, alice.id, docId, { email: "bob@ajaia.test", role: "admin" }))).toBe(400);
  });

  it("treats malformed ids as not found instead of crashing", async () => {
    expect(await statusOf(getDocument(db, alice.id, "not-a-uuid"))).toBe(404);
  });

  it("seed data shares the welcome doc from Alice to Bob as editor", async () => {
    const bobDocs = await listDocuments(db, bob.id);
    expect(bobDocs.shared).toEqual([expect.objectContaining({ title: "Welcome to Ajaia Docs", role: "editor" })]);
  });
});
