"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@/lib/client-api";
import type { DocSummary } from "@/lib/documents";

const ACCEPT = ".txt,.md,.docx";
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function DocList({ owned, shared }: { owned: DocSummary[]; shared: DocSummary[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | "create" | "import">(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function createDoc() {
    setBusy("create");
    setError(null);
    try {
      const { id } = await api<{ id: string }>("/api/documents", { method: "POST", json: {} });
      router.push(`/docs/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  async function importFile(file: File) {
    setError(null);
    if (file.size > MAX_UPLOAD_BYTES) return setError("That file is larger than 2 MB.");
    setBusy("import");
    try {
      const body = new FormData();
      body.append("file", file);
      const { id } = await api<{ id: string }>("/api/documents/import", { method: "POST", body });
      router.push(`/docs/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function deleteDoc(id: string) {
    setError(null);
    try {
      await api(`/api/documents/${id}`, { method: "DELETE" });
      setConfirmDelete(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <section className="actions">
        <button className="new-doc" onClick={createDoc} disabled={busy !== null}>
          <span className="plus">+</span>
          <span>{busy === "create" ? "Creating…" : "Blank document"}</span>
        </button>
        <button className="new-doc" onClick={() => fileInput.current?.click()} disabled={busy !== null}>
          <span className="plus">⤒</span>
          <span>{busy === "import" ? "Importing…" : "Import a file"}</span>
          <span className="hint">.txt, .md or .docx · max 2 MB</span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
        />
      </section>

      {error && (
        <p className="error banner" role="alert">
          {error}
        </p>
      )}

      <DocSection title="My documents" empty="You haven't created any documents yet.">
        {owned.map((d) => (
          <li key={d.id}>
            <Link href={`/docs/${d.id}`} className="doc-link">
              <span className="doc-icon">▤</span>
              <span className="doc-title">{d.title}</span>
            </Link>
            <span className="muted small">Edited {formatDate(d.updatedAt)}</span>
            {confirmDelete === d.id ? (
              <span className="row-actions">
                <button className="btn danger small" onClick={() => deleteDoc(d.id)}>
                  Confirm delete
                </button>
                <button className="btn small" onClick={() => setConfirmDelete(null)}>
                  Cancel
                </button>
              </span>
            ) : (
              <button className="btn ghost small" onClick={() => setConfirmDelete(d.id)} aria-label={`Delete ${d.title}`}>
                Delete
              </button>
            )}
          </li>
        ))}
      </DocSection>

      <DocSection title="Shared with me" empty="Nothing has been shared with you yet.">
        {shared.map((d) => (
          <li key={d.id}>
            <Link href={`/docs/${d.id}`} className="doc-link">
              <span className="doc-icon shared">▤</span>
              <span className="doc-title">{d.title}</span>
            </Link>
            <span className="muted small">
              Owner: {d.ownerName} · Edited {formatDate(d.updatedAt)}
            </span>
            <span className={`badge ${d.role}`}>{d.role === "editor" ? "Can edit" : "View only"}</span>
          </li>
        ))}
      </DocSection>
    </>
  );
}

function DocSection({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section className="doc-section">
      <h2>{title}</h2>
      {children.length === 0 ? <p className="muted empty">{empty}</p> : <ul className="doc-list">{children}</ul>}
    </section>
  );
}
