"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import type { Share } from "@/lib/documents";

type Role = Share["role"];

export default function ShareDialog({ docId, title, onClose }: { docId: string; title: string; onClose: () => void }) {
  const [shares, setShares] = useState<Share[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
    api<Share[]>(`/api/documents/${docId}/shares`)
      .then(setShares)
      .catch((err) => setError(err.message));
  }, [docId]);

  async function grant(targetEmail: string, targetRole: Role) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const share = await api<Share>(`/api/documents/${docId}/shares`, {
        method: "POST",
        json: { email: targetEmail, role: targetRole },
      });
      setShares((prev) => [...(prev ?? []).filter((s) => s.userId !== share.userId), share]);
      setNotice(`${share.name} can now ${share.role === "editor" ? "edit" : "view"} this document.`);
      setEmail("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(share: Share) {
    setError(null);
    setNotice(null);
    try {
      await api(`/api/documents/${docId}/shares/${share.userId}`, { method: "DELETE" });
      setShares((prev) => prev?.filter((s) => s.userId !== share.userId) ?? null);
      setNotice(`Removed access for ${share.name}.`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <dialog ref={dialog} className="dialog" onClose={onClose} aria-labelledby="share-title">
      <h2 id="share-title">Share “{title}”</h2>
      <form
        className="share-form"
        onSubmit={(e) => {
          e.preventDefault();
          grant(email, role);
        }}
      >
        <input
          type="email"
          placeholder="Add people by email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          aria-label="Email address"
        />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Access level">
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
        <button className="btn primary" disabled={busy || !email}>
          {busy ? "Sharing…" : "Share"}
        </button>
      </form>
      <p className="hint">They need an Ajaia Docs account. Demo users: bob@ajaia.test, carol@ajaia.test.</p>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && <p className="notice">{notice}</p>}

      <h3>People with access</h3>
      <ul className="share-list">
        <li>
          <span>You</span>
          <span className="muted small">Owner</span>
        </li>
        {shares === null && !error && <li className="muted">Loading…</li>}
        {shares?.map((s) => (
          <li key={s.userId}>
            <span>
              {s.name} <span className="muted small">{s.email}</span>
            </span>
            <span className="row-actions">
              <select
                value={s.role}
                onChange={(e) => grant(s.email, e.target.value as Role)}
                aria-label={`Access for ${s.name}`}
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button className="btn ghost small" onClick={() => revoke(s)} aria-label={`Remove ${s.name}`}>
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>

      <div className="dialog-actions">
        <button className="btn" onClick={() => dialog.current?.close()}>
          Done
        </button>
      </div>
    </dialog>
  );
}
