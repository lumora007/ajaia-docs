"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";

const DEMO_ACCOUNTS = [
  { name: "Alice", email: "alice@ajaia.test" },
  { name: "Bob", email: "bob@ajaia.test" },
  { name: "Carol", email: "carol@ajaia.test" },
];
const DEMO_PASSWORD = "demo1234";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSignup = mode === "signup";

  async function submit(body: Record<string, string>) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/auth/${mode}`, { method: "POST", json: body });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="center-card">
      <form
        className="card auth"
        onSubmit={(e) => {
          e.preventDefault();
          submit(isSignup ? { name, email, password } : { email, password });
        }}
      >
        <div className="brand-lg">
          <span className="logo">A</span> Ajaia Docs
        </div>
        <h1>{isSignup ? "Create your account" : "Sign in"}</h1>

        {isSignup && (
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="name" />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={isSignup ? 8 : undefined}
            autoComplete={isSignup ? "new-password" : "current-password"}
          />
          {isSignup && <span className="hint">At least 8 characters.</span>}
        </label>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button className="btn primary full" disabled={busy}>
          {busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
        </button>

        <p className="muted small">
          {isSignup ? (
            <>
              Already have an account? <Link href="/login">Sign in</Link>
            </>
          ) : (
            <>
              New here? <Link href="/signup">Create an account</Link>
            </>
          )}
        </p>

        {!isSignup && (
          <div className="demo">
            <p className="small">
              <strong>Demo accounts</strong> (password <code>{DEMO_PASSWORD}</code>). Use two to test sharing.
            </p>
            <div className="demo-row">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => submit({ email: a.email, password: DEMO_PASSWORD })}
                >
                  Sign in as {a.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </main>
  );
}
