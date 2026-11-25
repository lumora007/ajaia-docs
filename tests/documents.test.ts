import { describe, expect, it } from "vitest";
import { createSession, getUserBySession, signup } from "@/lib/auth";
import { convertUpload, textToHtml } from "@/lib/convert";
import { createDocument, getDocument, updateDocument } from "@/lib/documents";
import { setup, statusOf } from "./helpers";

describe("document persistence", () => {
  it("round-trips rich-text formatting and strips unsafe markup", async () => {
    const { db, alice } = await setup();
    const { id } = await createDocument(db, alice.id, {});
    const html =
      '<h1>Title</h1><p><strong>b</strong> <em>i</em> <u>u</u></p><ul><li><p>one</p></li></ul><ol><li><p>two</p></li></ol>';
    await updateDocument(db, alice.id, id, {
      title: "  Renamed  ",
      contentHtml: `${html}<script>alert(1)</script><p onclick="x()">safe</p><img src=x onerror=alert(1)>`,
    });

    const doc = await getDocument(db, alice.id, id);
    expect(doc.title).toBe("Renamed");
    expect(doc.contentHtml).toBe(`${html}<p>safe</p>`);
  });

  it("validates titles and empty updates", async () => {
    const { db, alice } = await setup();
    const { id } = await createDocument(db, alice.id, {});
    expect((await getDocument(db, alice.id, id)).title).toBe("Untitled document");
    expect(await statusOf(updateDocument(db, alice.id, id, { title: "   " }))).toBe(400);
    expect(await statusOf(updateDocument(db, alice.id, id, { title: "x".repeat(201) }))).toBe(400);
    expect(await statusOf(updateDocument(db, alice.id, id, {}))).toBe(400);
  });
});

describe("auth", () => {
  it("signs up, rejects duplicates, and resolves sessions", async () => {
    const { db } = await setup();
    const user = await signup(db, { name: "Dana", email: "Dana@Example.com", password: "longenough" });
    expect(user.email).toBe("dana@example.com");
    expect(await statusOf(signup(db, { name: "Dana", email: "dana@example.com", password: "longenough" }))).toBe(409);
    expect(await statusOf(signup(db, { name: "E", email: "e@example.com", password: "short" }))).toBe(400);

    const token = await createSession(db, user.id);
    expect(await getUserBySession(db, token)).toMatchObject({ id: user.id });
    expect(await getUserBySession(db, "forged-token")).toBeNull();
  });
});

describe("file import", () => {
  it("converts markdown with headings, emphasis and lists", async () => {
    const { title, html } = await convertUpload("meeting_notes.md", Buffer.from("# Notes\n\n**Bold** and *it*\n\n- a\n- b\n"));
    expect(title).toBe("meeting notes");
    expect(html).toContain("<h1>Notes</h1>");
    expect(html).toContain("<strong>Bold</strong>");
    expect(html).toContain("<em>it</em>");
    expect(html).toMatch(/<ul>\s*<li>a<\/li>/);
  });

  it("converts plain text into escaped paragraphs", () => {
    expect(textToHtml("Hello <b>\nworld\n\nSecond")).toBe("<p>Hello &lt;b&gt;<br>world</p><p>Second</p>");
  });

  it("rejects unsupported, empty and corrupt files", async () => {
    expect(await statusOf(convertUpload("photo.png", Buffer.from("x")))).toBe(415);
    expect(await statusOf(convertUpload("empty.txt", Buffer.alloc(0)))).toBe(400);
    expect(await statusOf(convertUpload("broken.docx", Buffer.from("not a zip")))).toBe(422);
  });
});

describe("docx import", () => {
  it("keeps headings, bold/italic/underline and bullet lists from a Word file", async () => {
    const { readFile } = await import("node:fs/promises");
    const { title, html } = await convertUpload("kickoff-brief.docx", await readFile("samples/kickoff-brief.docx"));
    expect(title).toBe("kickoff brief");
    expect(html).toContain("<h1>Project Kickoff Brief</h1>");
    expect(html).toContain("<strong>bold</strong>, <em>italic</em> and <u>underline</u>");
    expect(html).toContain("<ul><li>Ship the editor MVP</li><li>Validate sharing with two teams</li></ul>");
  });
});
