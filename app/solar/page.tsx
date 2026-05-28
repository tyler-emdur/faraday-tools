import SolarTool from "@/components/solar/SolarTool";

export const metadata = { title: "Solar Savings Estimator — Faraday Tools" };

export default function SolarPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10 max-w-2xl">
        <span className="section-tag" style={{ display: "inline-flex" }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          Tool 2 of 4
        </span>
        <h1 className="font-display font-black text-4xl sm:text-5xl text-white mt-3 mb-3">
          Solar Savings<br />
          <span style={{ color: "#f59e0b" }}>Estimator</span>
        </h1>
        <p className="text-slate-400 leading-relaxed">
          Colorado gets <strong className="text-white">300+ sunny days per year</strong> — more than Miami or Honolulu. This tool calculates exactly how much a homeowner would save with solar, using their actual address and real electricity costs.
        </p>
        <div className="flex flex-wrap gap-4 mt-5 text-sm text-slate-400">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            NREL solar irradiance data
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            Real CO electricity rates
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            25-year lifetime projection
          </div>
        </div>
      </div>

      <SolarTool />
    </div>
  );
}
