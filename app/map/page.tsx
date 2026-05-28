import dynamic from "next/dynamic";
import Link from "next/link";

export const metadata = { title: "Colorado Hail Map — Faraday Tools" };

const HailMapClient = dynamic(() => import("@/components/map/HailMapClient"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full rounded-2xl flex items-center justify-center border"
      style={{ height: 600, background: "rgba(12,21,37,0.8)", borderColor: "rgba(14,165,233,0.15)" }}
    >
      <div className="text-center">
        <svg className="animate-spin w-8 h-8 text-sky-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <p className="text-slate-400 text-sm">Loading map…</p>
      </div>
    </div>
  ),
});

export default function MapPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8 max-w-2xl">
        <span className="section-tag" style={{ display: "inline-flex" }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Tool 4 of 4
        </span>
        <h1 className="font-display font-black text-4xl sm:text-5xl text-white mt-3 mb-3">
          Colorado<br />
          <span style={{ color: "#22c55e" }}>Hail Map</span>
        </h1>
        <p className="text-slate-400 leading-relaxed">
          Every storm marker is a potential roof replacement. Use this map to identify neighborhoods that were recently hit — and homeowners who probably don&apos;t know their roof is damaged.
        </p>
      </div>

      <HailMapClient />

      <div className="mt-8 grid sm:grid-cols-2 gap-6">
        <div className="tool-card">
          <h3 className="font-display font-semibold text-white mb-2">How to use this map</h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex items-start gap-2"><span className="text-sky-400 mt-0.5">→</span>Click any marker to see storm details</li>
            <li className="flex items-start gap-2"><span className="text-sky-400 mt-0.5">→</span>Red markers indicate hail large enough for certain roof damage</li>
            <li className="flex items-start gap-2"><span className="text-sky-400 mt-0.5">→</span>Use "Check my home" in a popup to start an inspection request</li>
          </ul>
        </div>
        <div
          className="tool-card flex flex-col justify-between"
          style={{ borderColor: "rgba(14,165,233,0.2)", background: "linear-gradient(135deg, rgba(14,165,233,0.07) 0%, rgba(12,21,37,1) 60%)" }}
        >
          <div>
            <h3 className="font-display font-semibold text-white mb-2">Was your home in a storm zone?</h3>
            <p className="text-sm text-slate-400">Enter your address for a detailed hail history and roof risk assessment.</p>
          </div>
          <Link href="/hail" className="btn-primary mt-4 self-start">
            Check my address →
          </Link>
        </div>
      </div>
    </div>
  );
}
