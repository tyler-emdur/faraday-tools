export default function Footer() {
  return (
    <footer
      className="border-t mt-auto"
      style={{ borderColor: "rgba(14,165,233,0.1)" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center text-white font-black text-xs"
              style={{ background: "linear-gradient(135deg,#0ea5e9,#0369a1)" }}
            >
              F
            </div>
            <span className="text-sm text-slate-400">
              Faraday Tools — Internal Demo
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <a
              href="https://faradaysun.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-sky-400 transition-colors"
            >
              faradaysun.com
            </a>
            <span>© 2025 Faraday Construction & Solar</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
