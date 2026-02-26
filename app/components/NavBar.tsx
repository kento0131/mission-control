"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/office",    label: "Office"    },
  { href: "/jobs",      label: "Jobs"      },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: "2rem",
        padding: "0.875rem 1.5rem",
        borderBottom: "1px solid var(--border)",
        backgroundColor: "var(--bg-card)",
      }}
    >
      <span style={{ fontWeight: 700, fontSize: "1rem", letterSpacing: "-0.02em" }}>
        Mission Control
      </span>
      <div style={{ display: "flex", gap: "1.25rem" }}>
        {links.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              style={{
                fontSize: "0.875rem",
                color: active ? "var(--text)" : "var(--text-muted)",
                fontWeight: active ? 600 : 400,
                borderBottom: active ? "2px solid var(--text)" : "2px solid transparent",
                paddingBottom: "0.125rem",
              }}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
