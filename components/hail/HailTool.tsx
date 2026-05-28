"use client";

import { useState } from "react";
import type { HailResult } from "@/lib/types";
import Link from "next/link";

const ROOF_AGES = [
  { value: "3", label: "0–5 years", sub: "New / recently replaced" },
  { value: "8", label: "5–10 years", sub: "Mid-life, good condition" },
  { value: "13", label: "10–15 years", sub: "Approaching end of warranty" },
  { value: "18", label: "15–20 years", sub: "High-risk for hidden damage" },
  { value: "25", label: "20+ years", sub: "Past typical lifespan" },
];

const RISK_CONFIG = {
  Critical: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", dot: "bg-red-400" },
  High:     { color: "#f97316", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.3)", dot: "bg-orange-400" },
  Moderate: { color: "#eab308", bg: "rgba(234,179,8,0.1)",  border: "rgba(234,179,8,0.3)",  dot: "bg-yellow-400" },
  Low:      { color: "#22c55e", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.25)", dot: "bg-green-400"  },
};

function RiskGauge({ score, level }: { score: number; level: HailResult["riskLevel"] }) {
  const cfg = RISK_CONFIG[level];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
          <circle
            cx="60" cy="60" r="52" fill="none"
            stroke={cfg.color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 326.7} 326.7`}
            style={{ filter: `drop-shadow(0 0 8px ${cfg.color})`, transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
          <span className="text-3xl font-black text-white">{score}</span>
          <span className="text-xs font-semibold" style={{ color: cfg.color }}>{level}</span>
        </div>
      </div>
      <p className="text-xs text-slate-400 text-center">Risk Score (0–100)</p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    extreme: "severity-severe",
    severe: "severity-severe",
    moderate: "severity-moderate",
    minor: "severity-minor",
    none: "severity-none",
  };
  return (
    <span className={map[severity] ?? "severity-none"}>
      <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
}

export default function HailTool() {
  const [address, setAddress] = useState("");
  const [roofAge, setRoofAge] = useState("13");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HailResult | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", phone: "", email: "", notes: "" });
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setShowForm(false);
    setSubmitted(false);
    try {
      const res = await fetch("/api/hail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, roofAge }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to look up hail data");
    } finally {
      setLoading(false);
    }
  }

  function handleInspectionSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  const cfg = result ? RISK_CONFIG[result.riskLevel] : null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Input card */}
      <div className="tool-card">
        <h2 className="font-display font-bold text-xl text-white mb-1">Check Your Address</h2>
        <p className="text-slate-400 text-sm mb-6">
          Enter a Colorado address to pull recent hail events and estimate your roof's risk.
        </p>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Property Address</label>
            <div className="relative">
              <svg className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 1234 Main St, Denver, CO 80203"
                className="input-field pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Approximate Roof Age</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {ROOF_AGES.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setRoofAge(a.value)}
                  className={`p-3 rounded-xl text-left transition-all duration-200 border ${
                    roofAge === a.value
                      ? "border-sky-500 bg-sky-500/10 text-white"
                      : "border-white/8 bg-white/3 text-slate-400 hover:border-sky-500/40 hover:text-white"
                  }`}
                >
                  <div className="text-sm font-semibold leading-tight">{a.label}</div>
                  <div className="text-xs opacity-60 mt-0.5 leading-tight">{a.sub}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !address.trim()}
            className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzing hail data...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Check Hail History
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {result && cfg && (
        <div className="space-y-6 animate-fade-up">
          {/* Risk overview */}
          <div
            className="tool-card flex flex-col md:flex-row items-center md:items-start gap-8"
            style={{ borderColor: cfg.border, background: `linear-gradient(135deg, ${cfg.bg} 0%, rgba(12,21,37,1) 60%)` }}
          >
            <RiskGauge score={result.riskScore} level={result.riskLevel} />
            <div className="flex-1 text-center md:text-left">
              <div className="text-xs font-semibold tracking-widest text-slate-400 uppercase mb-1">Risk Assessment</div>
              <h3 className="font-display font-black text-2xl text-white mb-2">{result.riskLevel} Risk</h3>
              <p className="text-slate-300 text-sm leading-relaxed">{result.roofAssessment}</p>
              <div className="mt-4 flex flex-wrap gap-3 justify-center md:justify-start">
                {result.lastEventDaysAgo !== null && (
                  <div className="text-center px-4 py-2 rounded-lg bg-white/5 border border-white/8">
                    <div className="text-lg font-bold text-white">{result.lastEventDaysAgo}d</div>
                    <div className="text-xs text-slate-400">Since last hail</div>
                  </div>
                )}
                <div className="text-center px-4 py-2 rounded-lg bg-white/5 border border-white/8">
                  <div className="text-lg font-bold text-white">{result.events.length}</div>
                  <div className="text-xs text-slate-400">Recent events</div>
                </div>
                {result.events[0] && (
                  <div className="text-center px-4 py-2 rounded-lg bg-white/5 border border-white/8">
                    <div className="text-lg font-bold text-white">{result.events[0].maxSizeIn}"</div>
                    <div className="text-xs text-slate-400">Largest hail</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Event timeline */}
          {result.events.length > 0 && (
            <div className="tool-card">
              <h3 className="font-display font-semibold text-white mb-5 flex items-center gap-2">
                <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Recent Hail Events Near This Address
              </h3>
              <div className="space-y-4">
                {result.events.map((event, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-4 p-4 rounded-xl border"
                    style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }}
                  >
                    <div className="text-center min-w-[60px]">
                      <div className="text-lg font-black text-white">{event.maxSizeIn}"</div>
                      <div className="text-xs text-slate-500">diameter</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-white">
                          {new Date(event.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                        </span>
                        <SeverityBadge severity={event.severity} />
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          {!showForm && !submitted && (
            <div
              className="tool-card text-center"
              style={{ background: "linear-gradient(135deg, rgba(14,165,233,0.08) 0%, rgba(12,21,37,1) 60%)", borderColor: "rgba(14,165,233,0.25)" }}
            >
              <div className="mb-1 text-xs font-semibold tracking-widest text-sky-400 uppercase">Free Service</div>
              <h3 className="font-display font-bold text-xl text-white mb-2">Schedule Your Free Roof Inspection</h3>
              <p className="text-slate-400 text-sm mb-6 max-w-lg mx-auto">
                Faraday's certified inspectors will assess your roof at no cost. We work directly with insurance companies and handle the claim process for you.
              </p>
              <button onClick={() => setShowForm(true)} className="btn-primary mx-auto">
                Schedule Free Inspection →
              </button>
            </div>
          )}

          {/* Inspection form */}
          {showForm && !submitted && (
            <div className="tool-card animate-fade-up">
              <h3 className="font-display font-bold text-xl text-white mb-1">Book Your Free Inspection</h3>
              <p className="text-slate-400 text-sm mb-6">We'll confirm a time within one business day.</p>
              <form onSubmit={handleInspectionSubmit} className="space-y-4">
                <div
                  className="p-3 rounded-xl text-sm flex items-center gap-2"
                  style={{ background: "rgba(14,165,233,0.07)", border: "1px solid rgba(14,165,233,0.15)", color: "#38bdf8" }}
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  {result.address}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
                    <input className="input-field" placeholder="Jane Smith" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone</label>
                    <input className="input-field" placeholder="(303) 555-0100" type="tel" value={formData.phone} onChange={e => setFormData(p => ({...p, phone: e.target.value}))} required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                  <input className="input-field" placeholder="jane@example.com" type="email" value={formData.email} onChange={e => setFormData(p => ({...p, email: e.target.value}))} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Anything else we should know?</label>
                  <textarea className="input-field resize-none h-24" placeholder="Gate code, best times, specific concerns..." value={formData.notes} onChange={e => setFormData(p => ({...p, notes: e.target.value}))} />
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="btn-primary flex-1 justify-center">Confirm Inspection Request</button>
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary px-4">Cancel</button>
                </div>
              </form>
            </div>
          )}

          {submitted && (
            <div
              className="tool-card text-center animate-fade-up"
              style={{ borderColor: "rgba(34,197,94,0.3)", background: "linear-gradient(135deg, rgba(34,197,94,0.07) 0%, rgba(12,21,37,1) 60%)" }}
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-green-500/15 border border-green-500/30">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-2">Request Received!</h3>
              <p className="text-slate-400 text-sm">A Faraday team member will contact <strong className="text-white">{formData.name || "you"}</strong> within one business day to schedule your free roof inspection at <strong className="text-white">{result.address}</strong>.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
