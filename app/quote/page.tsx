import QuoteTool from "@/components/quote/QuoteTool";

export const metadata = { title: "Smart Quote Request — Faraday Tools" };

export default function QuotePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10 max-w-2xl">
        <span className="section-tag" style={{ display: "inline-flex" }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Tool 3 of 4
        </span>
        <h1 className="font-display font-black text-4xl sm:text-5xl text-white mt-3 mb-3">
          Smart Quote<br />
          <span style={{ color: "#0ea5e9" }}>Request</span>
        </h1>
        <p className="text-slate-400 leading-relaxed">
          A guided 3-step form that collects exactly what your team needs to prepare a real estimate — no phone tag, no back-and-forth. Better for the customer, better for your sales pipeline.
        </p>
        <div className="flex flex-wrap gap-4 mt-5 text-sm text-slate-400">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            Guided multi-step UX
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            Photo upload support
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            All 5 service types
          </div>
        </div>
      </div>

      <QuoteTool />
    </div>
  );
}
