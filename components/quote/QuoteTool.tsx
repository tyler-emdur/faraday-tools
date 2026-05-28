"use client";

import { useState } from "react";

const SERVICES = [
  { id: "roofing",  label: "Roofing",  icon: "🏠", desc: "Repair, replacement, or inspection" },
  { id: "solar",    label: "Solar",    icon: "☀️", desc: "Installation or expansion" },
  { id: "windows",  label: "Windows",  icon: "🪟", desc: "Replacement or new installation" },
  { id: "hail",     label: "Hail Damage", icon: "🌧️", desc: "Insurance claim support" },
  { id: "interior", label: "Interior", icon: "🔨", desc: "Remodeling or restoration" },
  { id: "other",    label: "Other",    icon: "📋", desc: "Tell us what you need" },
];

const TIMELINES = [
  { id: "asap",    label: "ASAP",         sub: "Emergency / urgent need" },
  { id: "1month",  label: "Within 1 month", sub: "Planning ahead" },
  { id: "3months", label: "1–3 months",   sub: "Not in a rush" },
  { id: "later",   label: "Just exploring", sub: "Gathering info" },
];

const STEPS = ["Service Type", "Project Details", "Contact Info"];

export default function QuoteTool() {
  const [step, setStep] = useState(0);
  const [service, setService] = useState("");
  const [description, setDescription] = useState("");
  const [hasFile, setHasFile] = useState(false);
  const [timeline, setTimeline] = useState("");
  const [contact, setContact] = useState({ name: "", phone: "", email: "", address: "" });
  const [submitted, setSubmitted] = useState(false);

  function next() { setStep((s) => Math.min(s + 1, 2)); }
  function back() { setStep((s) => Math.max(s - 1, 0)); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto">
        <div
          className="tool-card text-center py-16 animate-fade-up"
          style={{ borderColor: "rgba(34,197,94,0.3)", background: "linear-gradient(135deg, rgba(34,197,94,0.07) 0%, rgba(12,21,37,1) 60%)" }}
        >
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-green-500/15 border-2 border-green-500/40">
            <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-display font-black text-3xl text-white mb-3">You're on the list!</h2>
          <p className="text-slate-400 mb-2">
            We received your <strong className="text-white">{SERVICES.find(s => s.id === service)?.label}</strong> quote request.
          </p>
          <p className="text-slate-400 text-sm mb-8">
            <strong className="text-white">{contact.name}</strong>, our team will reach out to <strong className="text-white">{contact.email}</strong> within one business day with a detailed estimate.
          </p>
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm mb-8"
            style={{ background: "rgba(14,165,233,0.07)", border: "1px solid rgba(14,165,233,0.15)", color: "#38bdf8" }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Timeline preference: <strong>{TIMELINES.find(t => t.id === timeline)?.label || "Flexible"}</strong>
          </div>
          <div className="flex gap-3 justify-center">
            <a href="/" className="btn-secondary">← Back to Tools</a>
            <a href="/hail" className="btn-primary">Check Hail Risk</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress stepper */}
      <div className="flex items-center justify-between mb-10 relative">
        <div
          className="absolute top-4 left-0 right-0 h-px"
          style={{ background: "rgba(14,165,233,0.12)" }}
        />
        <div
          className="absolute top-4 left-0 h-px transition-all duration-500"
          style={{
            width: `${(step / (STEPS.length - 1)) * 100}%`,
            background: "linear-gradient(90deg, #0ea5e9, #38bdf8)",
            boxShadow: "0 0 8px rgba(14,165,233,0.5)",
          }}
        />
        {STEPS.map((s, i) => (
          <div key={s} className="relative flex flex-col items-center gap-2 z-10">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                i < step ? "bg-sky-500 text-white" :
                i === step ? "border-2 border-sky-400 text-sky-400 bg-navy-900" :
                "border border-slate-700 text-slate-500 bg-navy-900"
              }`}
            >
              {i < step ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i === step ? "text-sky-400" : i < step ? "text-slate-300" : "text-slate-500"}`}>
              {s}
            </span>
          </div>
        ))}
      </div>

      {/* Step 0: Service selection */}
      {step === 0 && (
        <div className="tool-card animate-fade-up">
          <h2 className="font-display font-bold text-xl text-white mb-1">What type of work do you need?</h2>
          <p className="text-slate-400 text-sm mb-6">Select the service that best describes your project.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {SERVICES.map((s) => (
              <button
                key={s.id}
                onClick={() => setService(s.id)}
                className={`p-4 rounded-xl text-left border transition-all duration-200 ${
                  service === s.id
                    ? "border-sky-500 bg-sky-500/10"
                    : "border-white/8 bg-white/2 hover:border-sky-500/40"
                }`}
              >
                <div className="text-2xl mb-2">{s.icon}</div>
                <div className={`font-semibold text-sm ${service === s.id ? "text-white" : "text-slate-300"}`}>{s.label}</div>
                <div className="text-xs text-slate-500 mt-0.5 leading-tight">{s.desc}</div>
              </button>
            ))}
          </div>
          <button
            onClick={next}
            disabled={!service}
            className="btn-primary w-full justify-center disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
          >
            Continue →
          </button>
        </div>
      )}

      {/* Step 1: Project details */}
      {step === 1 && (
        <div className="tool-card animate-fade-up">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">{SERVICES.find(s => s.id === service)?.icon}</span>
            <h2 className="font-display font-bold text-xl text-white">Tell us about the project</h2>
          </div>
          <p className="text-slate-400 text-sm mb-6">The more detail you provide, the more accurate your estimate will be.</p>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Project Description <span className="text-slate-500">(optional but helpful)</span>
              </label>
              <textarea
                className="input-field resize-none h-32"
                placeholder={`Describe your ${SERVICES.find(s=>s.id===service)?.label.toLowerCase()} project — what's the issue, what outcome do you want, anything relevant...`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Photo Upload (optional)</label>
              <label
                className={`flex flex-col items-center justify-center gap-3 h-28 rounded-xl cursor-pointer transition-all duration-200 border-2 border-dashed ${
                  hasFile
                    ? "border-sky-500/50 bg-sky-500/5"
                    : "border-white/10 bg-white/2 hover:border-sky-500/30 hover:bg-sky-500/3"
                }`}
                onClick={() => setHasFile(!hasFile)}
              >
                {hasFile ? (
                  <>
                    <svg className="w-7 h-7 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sky-400 text-sm font-medium">photo_roof.jpg attached</span>
                    <span className="text-slate-500 text-xs">Click to remove</span>
                  </>
                ) : (
                  <>
                    <svg className="w-7 h-7 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-slate-400 text-sm">Click to attach a photo</span>
                    <span className="text-slate-500 text-xs">JPG, PNG, HEIC up to 20MB</span>
                  </>
                )}
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">When do you need this done?</label>
              <div className="grid grid-cols-2 gap-2">
                {TIMELINES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTimeline(t.id)}
                    className={`p-3 rounded-xl text-left transition-all duration-200 border ${
                      timeline === t.id
                        ? "border-sky-500 bg-sky-500/10 text-white"
                        : "border-white/8 bg-white/2 text-slate-400 hover:border-sky-500/40 hover:text-white"
                    }`}
                  >
                    <div className="font-semibold text-sm">{t.label}</div>
                    <div className="text-xs opacity-60 mt-0.5">{t.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={back} className="btn-secondary px-5">← Back</button>
            <button onClick={next} className="btn-primary flex-1 justify-center">Continue →</button>
          </div>
        </div>
      )}

      {/* Step 2: Contact */}
      {step === 2 && (
        <div className="tool-card animate-fade-up">
          <h2 className="font-display font-bold text-xl text-white mb-1">Almost there — your contact info</h2>
          <p className="text-slate-400 text-sm mb-6">We'll use this to send your estimate and schedule a site visit.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
                <input className="input-field" placeholder="Jane Smith" value={contact.name} onChange={e => setContact(p=>({...p,name:e.target.value}))} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone</label>
                <input className="input-field" placeholder="(303) 555-0100" type="tel" value={contact.phone} onChange={e => setContact(p=>({...p,phone:e.target.value}))} required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input className="input-field" placeholder="jane@example.com" type="email" value={contact.email} onChange={e => setContact(p=>({...p,email:e.target.value}))} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Property Address</label>
              <input className="input-field" placeholder="1234 Main St, Denver, CO 80203" value={contact.address} onChange={e => setContact(p=>({...p,address:e.target.value}))} required />
            </div>

            {/* Summary */}
            <div className="p-4 rounded-xl space-y-2 text-sm" style={{ background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.12)" }}>
              <div className="text-xs font-semibold tracking-widest text-sky-400 uppercase mb-2">Request Summary</div>
              <div className="flex justify-between"><span className="text-slate-400">Service</span><span className="text-white">{SERVICES.find(s=>s.id===service)?.label}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Timeline</span><span className="text-white">{TIMELINES.find(t=>t.id===timeline)?.label || "Flexible"}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Photo</span><span className="text-white">{hasFile ? "Included" : "Not included"}</span></div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={back} className="btn-secondary px-5">← Back</button>
              <button
                type="submit"
                disabled={!contact.name || !contact.email || !contact.phone || !contact.address}
                className="btn-primary flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
              >
                Submit Quote Request
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
