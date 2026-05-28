import Link from "next/link";

const TOOLS = [
  {
    href: "/hail",
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
      </svg>
    ),
    tag: "Most Popular",
    title: "Hail Damage Lead Generator",
    description:
      "Enter any address to instantly see recent hail events, storm severity, and a roof risk score. Converts homeowners into inspection leads.",
    cta: "Check an address →",
    accent: "#ef4444",
    accentBg: "rgba(239,68,68,0.08)",
    accentBorder: "rgba(239,68,68,0.2)",
  },
  {
    href: "/solar",
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    tag: "High Value",
    title: "Solar Savings Estimator",
    description:
      "Show homeowners exactly how much they'd save with solar — annual savings, payback period, and a monthly chart — before they even get a quote.",
    cta: "Estimate savings →",
    accent: "#f59e0b",
    accentBg: "rgba(245,158,11,0.08)",
    accentBorder: "rgba(245,158,11,0.2)",
  },
  {
    href: "/quote",
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    tag: "Converts Better",
    title: "Smart Quote Request",
    description:
      "A guided 3-step form that walks homeowners through their project — far more effective than a generic contact form.",
    cta: "Try the form →",
    accent: "#0ea5e9",
    accentBg: "rgba(14,165,233,0.08)",
    accentBorder: "rgba(14,165,233,0.2)",
  },
  {
    href: "/map",
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
    tag: "Visual",
    title: "Colorado Hail Map",
    description:
      "Interactive map of recent Colorado hail storms color-coded by severity. Great for showing homeowners they're in an active hail zone.",
    cta: "View the map →",
    accent: "#22c55e",
    accentBg: "rgba(34,197,94,0.08)",
    accentBorder: "rgba(34,197,94,0.2)",
  },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden min-h-[80vh] flex items-center">
        {/* Background */}
        <div className="absolute inset-0 bg-grid-pattern bg-grid" />
        <div className="absolute inset-0 bg-hero-gradient" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 60%, #04080f)" }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase mb-6"
            style={{ background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)", color: "#38bdf8" }}>
            Internal Tools Demo
          </div>

          <h1 className="font-display font-black text-5xl sm:text-6xl lg:text-7xl text-white leading-tight mb-6">
            Faraday<br />
            <span style={{ color: "#0ea5e9", textShadow: "0 0 40px rgba(14,165,233,0.4)" }}>
              Tools
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-4 leading-relaxed">
            A suite of smart, client-facing tools that turn curious homeowners into qualified leads — built specifically for Faraday's roofing and solar business.
          </p>
          <p className="text-sm text-slate-500 mb-10">
            Powered by real weather data, NREL solar irradiance, and live hail event records.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/hail" className="btn-primary text-base px-8 py-4">
              Try the Hail Tool →
            </Link>
            <Link href="/solar" className="btn-secondary text-base px-8 py-4">
              Solar Estimator
            </Link>
          </div>

          {/* Stats row */}
          <div className="mt-16 flex flex-wrap justify-center gap-8">
            {[
              { value: "4", label: "Smart Tools" },
              { value: "Real", label: "Weather Data" },
              { value: "Free", label: "Inspections CTA" },
              { value: "Demo-ready", label: "Today" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-display font-black text-2xl text-white">{s.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tools grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="section-header">
          <span className="section-tag">The Tools</span>
          <h2 className="font-display font-black text-3xl sm:text-4xl text-white">
            Four tools. One pitch.
          </h2>
          <p className="text-slate-400 mt-3 max-w-xl mx-auto">
            Each tool is designed to do one thing well — move a homeowner from &ldquo;curious&rdquo; to &ldquo;ready to talk.&rdquo;
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {TOOLS.map((tool, i) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="tool-card group block"
              style={
                i === 0
                  ? { borderColor: tool.accentBorder, background: `linear-gradient(135deg, ${tool.accentBg} 0%, rgba(12,21,37,1) 60%)` }
                  : {}
              }
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="p-2.5 rounded-xl"
                  style={{ background: tool.accentBg, color: tool.accent, border: `1px solid ${tool.accentBorder}` }}
                >
                  {tool.icon}
                </div>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: tool.accentBg, color: tool.accent, border: `1px solid ${tool.accentBorder}` }}
                >
                  {tool.tag}
                </span>
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-2 group-hover:text-sky-300 transition-colors">
                {tool.title}
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">{tool.description}</p>
              <span className="text-sm font-semibold" style={{ color: tool.accent }}>
                {tool.cta}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Why section */}
      <section
        className="border-y py-20"
        style={{ borderColor: "rgba(14,165,233,0.1)", background: "linear-gradient(135deg, rgba(14,165,233,0.04) 0%, transparent 50%)" }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="section-tag">The pitch</span>
          <h2 className="font-display font-black text-3xl sm:text-4xl text-white mb-6">
            Why these tools pay for themselves
          </h2>
          <p className="text-slate-400 leading-relaxed mb-12 max-w-2xl mx-auto">
            Homeowners don&apos;t call a roofer unless something&apos;s wrong — or unless you show them something&apos;s wrong. These tools flip that script. A homeowner enters their address, sees their hail risk score, and calls you before they&apos;d have otherwise thought to.
          </p>
          <div className="grid sm:grid-cols-3 gap-6 text-left">
            {[
              { title: "Higher intent leads", body: "Someone who looked up their own hail risk is already halfway convinced. Your team spends time on warm leads, not cold calls." },
              { title: "Insurance claim pipeline", body: "The hail tool feeds directly into the inspection-to-insurance-claim workflow — a revenue stream many roofers don't fully capture." },
              { title: "Solar upsell built-in", body: "Every roofing lead is a solar prospect. The estimator tool shows the numbers before the conversation — no hard sell needed." },
            ].map((item) => (
              <div key={item.title} className="p-5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(14,165,233,0.1)" }}>
                <div className="w-1.5 h-1.5 rounded-full bg-sky-400 mb-3" />
                <h3 className="font-display font-bold text-white mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
