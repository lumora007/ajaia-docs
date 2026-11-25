"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/auth";
import { api } from "@/lib/client-api";

export default function Header({ user, children }: { user: User; children?: React.ReactNode }) {
  const router = useRouter();

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="topbar">
      <Link href="/" className="brand" title="All documents">
        <span className="logo">A</span>
        <span className="brand-name">Ajaia Docs</span>
      </Link>
      <div className="topbar-middle">{children}</div>
      <div className="user">
        <span className="avatar" title={user.email}>
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="user-name">{user.name}</span>
        <button className="btn ghost" onClick={logout}>
          Sign out
        </button>
      </div>
    </header>
  );
}
