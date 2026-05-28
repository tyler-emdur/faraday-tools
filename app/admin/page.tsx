import type { Lead } from "@/lib/types";
import Link from "next/link";

export const metadata = { title: "Admin Dashboard — Faraday Tools" };

const LEADS: Lead[] = [
  { id: "L-001", name: "Jennifer Walsh",   address: "4821 Vine St, Denver, CO 80216",        service: "Hail Inspection",  date: "2025-05-26", status: "Scheduled", notes: "2.0\" hail event Aug 14. Roof is 12 yrs old." },
  { id: "L-002", name: "Marcus Delgado",   address: "1105 Overland Tr, Boulder, CO 80305",   service: "Solar Quote",      date: "2025-05-25", status: "Contacted", notes: "$210/mo bill. Estimator showed $1,680/yr savings." },
  { id: "L-003", name: "Patricia Nguyen",  address: "7734 S Krameria St, Aurora, CO 80016",  service: "Hail Inspection",  date: "2025-05-24", status: "New",       notes: "High risk score (82). 18-yr-old roof." },
  { id: "L-004", name: "David Kowalski",   address: "2290 Taft Ave, Lakewood, CO 80215",     service: "Roofing + Solar",  date: "2025-05-22", status: "Scheduled", notes: "Full roof replacement + solar install. Big job." },
  { id: "L-005", name: "Sandra Okonkwo",   address: "310 W Oak St, Fort Collins, CO 80521",  service: "Solar Quote",      date: "2025-05-20", status: "Closed",    notes: "Signed 8.4 kW system. $41,200 contract." },
  { id: "L-006", name: "Brian Tanner",     address: "9923 E Cornell Ave, Denver, CO 80231",  service: "Hail Inspection",  date: "2025-05-18", status: "Contacted", notes: "Found storm on the map, submitted hail tool." },
];

const STATUS_CFG = {
  New:       { color: "#38bdf8", bg: "rgba(56,189,248,0.1)",   border: "rgba(56,189,248,0.25)"  },
  Contacted: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",   border: "rgba(245,158,11,0.25)"  },
  Scheduled: { color: "#a78bfa", bg: "rgba(167,139,250,0.1)",  border: "rgba(167,139,250,0.25)" },
  Closed:    { color: "#22c55e", bg: "rgba(34,197,94,0.1)",    border: "rgba(34,197,94,0.25)"   },
};

function StatusBadge({ status }: { status: Lead["status"] }) {
  const cfg = STATUS_CFG[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

const stats = [
  { label: "Total Leads", value: "6", sub: "All time", color: "#38bdf8" },
  { label: "This Month",  value: "6", sub: "May 2025",  color: "#a78bfa" },
  { label: "Scheduled",   value: "2", sub: "Upcoming",  color: "#f59e0b" },
  { label: "Closed",      value: "1", sub: "$41.2k value", color: "#22c55e" },
];

export default function AdminPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <span className="section-tag" style={{ display: "inline-flex" }}>Internal</span>
          <h1 className="font-display font-black text-4xl text-white mt-2">Lead Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">All leads collected through Faraday Tools</p>
        </div>
        <div className="text-xs text-slate-500 font-mono px-3 py-2 rounded-lg border border-white/8 bg-white/3">
          Last updated: May 28, 2025 · 9:14 AM
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="tool-card">
            <div className="text-3xl font-black font-display" style={{ color: s.color }}>{s.value}</div>
            <div className="text-sm font-semibold text-white mt-1">{s.label}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Leads table */}
      <div className="tool-card overflow-hidden p-0">
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: "rgba(14,165,233,0.1)" }}>
          <h2 className="font-display font-semibold text-white">Recent Leads</h2>
          <span className="text-xs text-slate-500">{LEADS.length} records</span>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(14,165,233,0.08)" }}>
                {["ID", "Name", "Address", "Service", "Date", "Status", "Notes"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-6 py-3 text-xs font-semibold tracking-wider text-slate-500 uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LEADS.map((lead, i) => (
                <tr
                  key={lead.id}
                  className="transition-colors hover:bg-white/3"
                  style={i < LEADS.length - 1 ? { borderBottom: "1px solid rgba(255,255,255,0.04)" } : {}}
                >
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs text-slate-500">{lead.id}</span>
                  </td>
                  <td className="px-6 py-4 font-medium text-white whitespace-nowrap">{lead.name}</td>
                  <td className="px-6 py-4 text-slate-400 max-w-[200px] truncate">{lead.address}</td>
                  <td className="px-6 py-4">
                    <span className="whitespace-nowrap text-slate-300">{lead.service}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                    {new Date(lead.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={lead.status} />
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs max-w-[220px]">{lead.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          {LEADS.map((lead) => (
            <div key={lead.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-white">{lead.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{lead.address}</div>
                </div>
                <StatusBadge status={lead.status} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>{lead.service}</span>
                <span>{new Date(lead.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </div>
              <div className="text-xs text-slate-500">{lead.notes}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="mt-6 flex flex-wrap gap-3">
        {[
          { href: "/hail", label: "Hail Tool" },
          { href: "/solar", label: "Solar Tool" },
          { href: "/quote", label: "Quote Form" },
          { href: "/map", label: "Hail Map" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="btn-secondary text-sm px-4 py-2">
            {l.label} →
          </Link>
        ))}
      </div>
    </div>
  );
}
