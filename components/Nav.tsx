"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/hail", label: "Hail Leads" },
  { href: "/solar", label: "Solar Savings" },
  { href: "/quote", label: "Get a Quote" },
  { href: "/map", label: "Hail Map" },
  { href: "/admin", label: "Admin" },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav
      className="sticky top-0 z-50 border-b"
      style={{
        background: "rgba(4,8,15,0.85)",
        backdropFilter: "blur(12px)",
        borderColor: "rgba(14,165,233,0.12)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm"
              style={{ background: "linear-gradient(135deg,#0ea5e9,#0369a1)" }}
            >
              F
            </div>
            <div>
              <span className="font-display font-bold text-white text-lg leading-none">
                Faraday
              </span>
              <span
                className="font-display font-bold text-lg leading-none"
                style={{ color: "#0ea5e9" }}
              >
                {" "}
                Tools
              </span>
            </div>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  pathname === l.href
                    ? "text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
                style={
                  pathname === l.href
                    ? {
                        background: "rgba(14,165,233,0.12)",
                        color: "#38bdf8",
                      }
                    : {}
                }
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* CTA + mobile toggle */}
          <div className="flex items-center gap-3">
            <a
              href="https://faradaysun.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{
                background: "rgba(14,165,233,0.1)",
                border: "1px solid rgba(14,165,233,0.2)",
                color: "#38bdf8",
              }}
            >
              faradaysun.com ↗
            </a>
            <button
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white transition-colors"
              onClick={() => setOpen(!open)}
              aria-label="Toggle menu"
            >
              {open ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <div
            className="md:hidden border-t py-3 space-y-1"
            style={{ borderColor: "rgba(14,165,233,0.12)" }}
          >
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname === l.href ? "text-sky-400" : "text-slate-400"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
