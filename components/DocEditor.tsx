"use client";

import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@/lib/auth";
import { api } from "@/lib/client-api";
import type { Doc } from "@/lib/documents";
import Header from "./Header";
import ShareDialog from "./ShareDialog";
import Toolbar from "./Toolbar";

type SaveStatus = "saved" | "dirty" | "saving" | "error";
const AUTOSAVE_MS = 800;

export default function DocEditor({ doc, user }: { doc: Doc; user: User }) {
  const canEdit = doc.role !== "viewer";
  const isOwner = doc.role === "owner";

  const [title, setTitle] = useState(doc.title);
  const [titleDraft, setTitleDraft] = useState(doc.title);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  // Autosave bookkeeping lives in refs so the editor's callbacks never see stale values.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const queued = useRef(false);
  const statusRef = useRef<SaveStatus>("saved");
  const latestHtml = useRef(doc.contentHtml);
  const setSaveStatus = (s: SaveStatus) => {
    statusRef.current = s;
    setStatus(s);
  };

  const editor = useEditor({
    immediatelyRender: false,
    editable: canEdit,
    content: doc.contentHtml,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false } }),
      Placeholder.configure({ placeholder: canEdit ? "Start typing…" : "This document is empty." }),
    ],
    autofocus: canEdit && !doc.contentHtml ? "start" : false,
    editorProps: { attributes: { class: "doc-body", "aria-label": "Document content" } },
    onUpdate: ({ editor: e }) => {
      latestHtml.current = e.getHTML();
      setSaveStatus("dirty");
      if (timer.current) clearTimeout(timer.current);
      // Via ref: this callback is captured on the first render, before `editor` exists.
      timer.current = setTimeout(() => void saveRef.current(), AUTOSAVE_MS);
    },
  });

  // Saves are serialized: if an edit lands mid-save, one more save runs afterwards with the latest HTML.
  const saveContent = useCallback(async () => {
    if (!editor) return;
    if (timer.current) clearTimeout(timer.current);
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    inFlight.current = true;
    setSaveStatus("saving");
    try {
      await api(`/api/documents/${doc.id}`, { method: "PATCH", json: { contentHtml: editor.getHTML() } });
      setError(null);
      setSaveStatus(queued.current ? "dirty" : "saved");
    } catch (err) {
      setError((err as Error).message);
      setSaveStatus("error");
    } finally {
      inFlight.current = false;
      if (queued.current) {
        queued.current = false;
        void saveContent();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, doc.id]);
  const saveRef = useRef(saveContent);
  useEffect(() => {
    saveRef.current = saveContent;
  }, [saveContent]);

  // Ctrl/Cmd+S saves immediately; warn before leaving with unsaved changes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (canEdit && statusRef.current !== "saved") void saveContent();
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (statusRef.current !== "saved") e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [canEdit, saveContent]);

  // Leaving the page (in-app navigation or closing the tab) inside the debounce window:
  // send the pending edit with `keepalive` so it survives the page going away.
  useEffect(() => {
    const flushPending = () => {
      if (statusRef.current !== "dirty" || !timer.current) return;
      clearTimeout(timer.current);
      timer.current = null;
      statusRef.current = "saving";
      const body = JSON.stringify({ contentHtml: latestHtml.current });
      void fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: body.length < 60_000, // browsers cap keepalive bodies at 64 KB
      }).catch(() => undefined);
    };
    window.addEventListener("pagehide", flushPending);
    return () => {
      window.removeEventListener("pagehide", flushPending);
      flushPending();
    };
  }, [doc.id]);

  async function commitTitle() {
    const next = titleDraft.trim();
    if (!next) return setTitleDraft(title);
    if (next === title) return setTitleDraft(next);
    try {
      const res = await api<{ title: string }>(`/api/documents/${doc.id}`, { method: "PATCH", json: { title: next } });
      setTitle(res.title);
      setTitleDraft(res.title);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
      setTitleDraft(title);
    }
  }

  useEffect(() => {
    document.title = `${title} – Ajaia Docs`;
  }, [title]);

  return (
    <>
      <Header user={user}>
        <div className="doc-meta">
          <input
            className="title-input"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setTitleDraft(title);
                e.currentTarget.blur();
              }
            }}
            readOnly={!canEdit}
            maxLength={200}
            aria-label="Document title"
          />
          <div className="doc-sub">
            {!isOwner && <span className="muted small">Owned by {doc.ownerName}</span>}
            {doc.role === "viewer" && <span className="badge viewer">View only</span>}
            {doc.role === "editor" && <span className="badge editor">Can edit</span>}
            {canEdit && <SaveIndicator status={status} onRetry={saveContent} />}
          </div>
        </div>
        {isOwner && (
          <button className="btn primary" onClick={() => setSharing(true)}>
            Share
          </button>
        )}
      </Header>

      {canEdit && editor && <Toolbar editor={editor} />}
      {error && (
        <p className="error banner editor-error" role="alert">
          {error}
        </p>
      )}

      <main className="canvas">
        <div className="page">
          <EditorContent editor={editor} />
        </div>
      </main>

      {sharing && <ShareDialog docId={doc.id} title={title} onClose={() => setSharing(false)} />}
    </>
  );
}

function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  if (status === "error") {
    return (
      <span className="save error-text">
        Not saved ·{" "}
        <button className="link" onClick={onRetry}>
          Retry
        </button>
      </span>
    );
  }
  const text = { saved: "All changes saved", dirty: "Unsaved changes…", saving: "Saving…" }[status];
  return (
    <span className="save muted small" aria-live="polite">
      {text}
    </span>
  );
}
