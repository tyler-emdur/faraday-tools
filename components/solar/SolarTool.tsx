"use client";

import { useState } from "react";
import type { SolarResult } from "@/lib/types";
import SavingsChart from "./SavingsChart";

export default function SolarTool() {
  const [address, setAddress] = useState("");
  const [monthlyBill, setMonthlyBill] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SolarResult | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/solar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, monthlyBill }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Estimation failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to calculate");
    } finally {
      setLoading(false);
    }
  }

  const formatDollar = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Input */}
      <div className="tool-card">
        <h2 className="font-display font-bold text-xl text-white mb-1">Estimate Your Solar Savings</h2>
        <p className="text-slate-400 text-sm mb-6">
          Enter your address and average monthly electric bill to see your potential savings.
        </p>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Property Address</label>
              <div className="relative">
                <svg className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="1234 Main St, Denver, CO"
                  className="input-field pl-10"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Avg Monthly Electric Bill</label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-slate-400 font-medium text-sm">$</span>
                <input
                  type="number"
                  value={monthlyBill}
                  onChange={(e) => setMonthlyBill(e.target.value)}
                  placeholder="150"
                  min="20"
                  max="2000"
                  className="input-field pl-7"
                  required
                />
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !address.trim() || !monthlyBill}
            className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Calculating savings...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Calculate Solar Savings
              </>
            )}
          </button>
        </form>
        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6 animate-fade-up">
          {/* Key stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Annual Savings", value: formatDollar(result.annualSavings), sub: "per year", icon: "💰" },
              { label: "System Size", value: `${result.systemSizeKw} kW`, sub: "recommended", icon: "⚡" },
              { label: "Payback Period", value: `${result.paybackYears} yrs`, sub: "break-even", icon: "📅" },
              { label: "CO₂ Offset", value: `${(result.co2OffsetLbs / 2000).toFixed(1)}T`, sub: "per year", icon: "🌿" },
            ].map((s) => (
              <div key={s.label} className="tool-card text-center">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-2xl font-black text-white font-display">{s.value}</div>
                <div className="text-xs text-slate-400 mt-0.5">{s.sub}</div>
                <div className="text-xs font-medium text-sky-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="tool-card">
            <h3 className="font-display font-semibold text-white mb-1">Monthly Savings Breakdown</h3>
            <p className="text-slate-400 text-sm mb-6">
              Estimated monthly savings based on solar irradiance for your location.
              Total annual savings: <strong className="text-sky-400">{formatDollar(result.annualSavings)}</strong>
            </p>
            <SavingsChart monthlySavings={result.monthlySavings} />
          </div>

          {/* Lifetime value */}
          <div className="tool-card">
            <h3 className="font-display font-semibold text-white mb-4">25-Year Lifetime Value</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-white/6 bg-white/2">
                <div className="text-xs text-slate-400 mb-1">Total Savings</div>
                <div className="text-2xl font-black text-green-400 font-display">{formatDollar(result.annualSavings * 25)}</div>
              </div>
              <div className="p-4 rounded-xl border border-white/6 bg-white/2">
                <div className="text-xs text-slate-400 mb-1">Energy Produced</div>
                <div className="text-2xl font-black text-sky-400 font-display">{(result.annualProductionKwh * 25 / 1000).toFixed(0)} MWh</div>
              </div>
              <div className="p-4 rounded-xl border border-white/6 bg-white/2">
                <div className="text-xs text-slate-400 mb-1">CO₂ Avoided</div>
                <div className="text-2xl font-black text-emerald-400 font-display">{(result.co2OffsetLbs * 25 / 2000).toFixed(0)} tons</div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div
            className="tool-card text-center"
            style={{ background: "linear-gradient(135deg, rgba(14,165,233,0.08) 0%, rgba(12,21,37,1) 60%)", borderColor: "rgba(14,165,233,0.25)" }}
          >
            <div className="text-xs font-semibold tracking-widest text-sky-400 uppercase mb-1">No Obligation</div>
            <h3 className="font-display font-bold text-xl text-white mb-2">Ready to Go Solar?</h3>
            <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
              Get a precise quote based on your roof's actual dimensions, orientation, and shading. Takes 30 minutes on-site.
            </p>
            <a href="/quote" className="btn-primary inline-flex mx-auto">
              Get a Custom Solar Quote →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
