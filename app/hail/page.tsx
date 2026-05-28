import HailTool from "@/components/hail/HailTool";

export const metadata = { title: "Hail Lead Generator — Faraday Tools" };

export default function HailPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Page header */}
      <div className="mb-10 max-w-2xl">
        <span className="section-tag" style={{ display: "inline-flex" }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
          Tool 1 of 4
        </span>
        <h1 className="font-display font-black text-4xl sm:text-5xl text-white mt-3 mb-3">
          Hail Damage<br />
          <span style={{ color: "#0ea5e9" }}>Lead Generator</span>
        </h1>
        <p className="text-slate-400 leading-relaxed">
          Colorado averages <strong className="text-white">7–10 major hail events per year</strong> on the Front Range. Most homeowners don't know their roof was damaged until they find a leak — often years later. This tool shows them the risk before the damage spreads.
        </p>
        <div className="flex flex-wrap gap-4 mt-5 text-sm text-slate-400">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            Real hail event data
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            Roof age risk scoring
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            One-click inspection request
          </div>
        </div>
      </div>

      <HailTool />
    </div>
  );
}
