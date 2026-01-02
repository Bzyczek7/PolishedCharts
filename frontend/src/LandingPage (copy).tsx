import React from "react";
import HussarImage from "./components/Hussar.jpeg";

type Props = {
  onOpenChart: () => void;
  onLoginClick?: () => void;
  onGoogleClick?: () => void;
  onEmailClick?: () => void;
};

export default function LandingPage({
  onOpenChart,
  onLoginClick,
  onGoogleClick,
  onEmailClick,
}: Props) {
  return (
    <div className="min-h-screen bg-[#0b1220] text-slate-100">
      {/* subtle background texture */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.08]"
           style={{
             backgroundImage:
               "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.18) 1px, transparent 0)",
             backgroundSize: "28px 28px",
           }}
      />

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-slate-800/70 bg-[#0b1220]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="leading-tight">
            <div className="text-lg font-semibold tracking-tight">PolishedCharts</div>
            <div className="text-xs text-slate-400">by Marek (solo dev, Poland)</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onLoginClick}
              className="text-sm text-slate-300 hover:text-white"
            >
              Log in
            </button>

            <a
              href="https://ko-fi.com/marekdabrowski"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-[#DC143C] px-3 py-2 text-sm text-white hover:bg-[#DC143C]/10"
            >
              Support Marek (Ko‑fi)
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="relative mx-auto max-w-6xl px-4 py-12">
        {/* Main hero with Hussar as decorative side element */}
        <section className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
              Professional charting without the professional price
            </h1>

            <p className="mt-4 text-lg text-slate-300">
              Full-featured platforms charge <span className="text-white font-medium">€199.95/mo</span> for unlimited
              indicators, unlimited alerts, and multi-chart layouts. We offer the same capabilities—for free.
            </p>

            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/40 px-3 py-1 text-xs text-slate-300">
              <span className="h-2 w-2 rounded-full bg-[#DC143C]" />
              Data source: Yahoo Finance (typically ~15 min delayed). Real-time data is a future
              goal—funding needed.
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <button
                onClick={onOpenChart}
                className="w-full rounded-lg bg-[#DC143C] px-6 py-5 text-lg font-semibold tracking-wide text-white hover:bg-[#c51235]"
              >
                OPEN THE CHART
              </button>

              <button
                onClick={onGoogleClick}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/30 px-6 py-3 text-sm text-slate-100 hover:bg-slate-900/55"
              >
                Sign in with Google
              </button>

              <button
                onClick={onEmailClick}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/20 px-6 py-3 text-sm text-slate-100 hover:bg-slate-900/45"
              >
                Email login
              </button>

              <a
                href="https://ko-fi.com/marekdabrowski"
                target="_blank"
                rel="noreferrer"
                className="text-center text-sm text-slate-300 underline underline-offset-4 hover:text-white"
              >
                Request an indicator for $1+ support
              </a>
            </div>
          </div>

          {/* Hussar - smaller decorative element on the right */}
          <div className="hidden md:flex flex-col items-center gap-2">
            <img src={HussarImage} alt="Polish Hussar" className="w-48 h-48 object-contain opacity-90" />
            <div className="text-xs text-slate-500 text-center">Built in Poland with Love</div>
          </div>
        </section>

        {/* === SUPPORT & MEMBERSHIP SECTION === */}
        <section className="mt-12 grid gap-6 md:grid-cols-2">
          {/* Membership Card - Prominent */}
          <div className="rounded-2xl border-2 border-[#DC143C]/50 bg-gradient-to-br from-[#DC143C]/10 to-transparent p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#DC143C]">
                <span className="text-lg">⭐</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Optional Membership</h3>
                <div className="text-sm text-[#DC143C] font-semibold">from $3/mo • Cancel anytime</div>
              </div>
            </div>

            <ul className="space-y-2 mb-5 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-[#10b981] font-bold">✓</span>
                <span className="text-slate-200">Unlimited watchlists (synced to cloud)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#10b981] font-bold">✓</span>
                <span className="text-slate-200">Unlimited alerts & alarms</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#10b981] font-bold">✓</span>
                <span className="text-slate-200">Priority indicator requests</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#10b981] font-bold">✓</span>
                <span className="text-slate-200">Helps fund real-time data</span>
              </li>
            </ul>

            <a
              href="https://ko-fi.com/marekdabrowski"
              target="_blank"
              rel="noreferrer"
              className="block w-full rounded-lg bg-[#DC143C] px-4 py-4 text-center font-bold text-white hover:bg-[#c51235] transition-all"
            >
              Become a Member
            </a>
          </div>

          {/* One-time Donation Card */}
          <div className="rounded-2xl border-2 border-amber-500/50 bg-gradient-to-br from-amber-500/10 to-transparent p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500">
                <span className="text-lg">❤️</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">One-time Donation</h3>
                <div className="text-sm text-amber-400 font-semibold">Any amount helps • No pressure</div>
              </div>
            </div>

            <p className="mb-5 text-sm text-slate-300">
              Building this solo takes time. Even <span className="text-white font-semibold">$1</span> helps keep the servers running
              and brings new features faster.
            </p>

            <a
              href="https://ko-fi.com/marekdabrowski"
              target="_blank"
              rel="noreferrer"
              className="block w-full rounded-lg border-2 border-amber-500 bg-amber-500 px-4 py-4 text-center font-bold text-white hover:bg-amber-600 transition-all"
            >
              Donate on Ko‑fi
            </a>
          </div>
        </section>

        {/* Features */}
        <section className="mt-14">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Unlimited indicators", "50+ indicators per chart? We support unlimited—no artificial caps."],
              ["Custom alerts", "Trigger alerts from any indicator logic you need."],
              ["Watchlist + search", "Find symbols fast and manage your list."],
              ["Save layouts", "Bundle your indicators and reload setups instantly."],
              ["Overlay + oscillator panes", "Price overlays + dedicated indicator panels."],
              ["Synced crosshair", "Read values across all panes at once."],
            ].map(([title, desc]) => (
              <div
                key={title}
                className="rounded-xl border border-slate-800 bg-slate-900/25 p-4"
              >
                <div className="text-sm font-semibold">{title}</div>
                <div className="mt-2 text-sm text-slate-400">{desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Why this exists */}
        <section className="mt-14 rounded-2xl border border-slate-800 bg-slate-900/35 p-6">
          <h2 className="text-lg font-semibold">Why this exists</h2>
          <div className="mt-3 space-y-3 text-slate-300">
            <p>
              Full-featured platforms charge <span className="text-white font-medium">€199.95/month</span> for
              unlimited indicators, unlimited alerts, multi-chart layouts, and volume profile.
            </p>
            <p>
              Those computations cost pennies. What you're really paying for is infrastructure,
              expensive data deals, and large teams. We run lean—so you get professional tools
              for free instead of renting basic functionality.
            </p>
            <p>
              Support the project with a small membership, and you help keep it running + get priority on indicators.
            </p>
          </div>
        </section>

        {/* One-man show */}
        <section className="mt-6 rounded-2xl border border-[#DC143C]/40 bg-[#DC143C]/10 p-6">
          <h2 className="text-lg font-semibold">One-man show (Marek)</h2>
          <p className="mt-2 text-slate-200">
            I'm Marek, the only developer behind PolishedCharts.
          </p>
          <p className="mt-2 text-slate-300">
            All I ask is this: <span className="text-white">support the project if you can.</span> Even $1 helps.
            And if you want to feel even better—<span className="text-white">ask me to add an indicator you like.</span>
            I'll do my best to make it happen.
          </p>

          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <a
              href="https://ko-fi.com/marekdabrowski"
              target="_blank"
              rel="noreferrer"
              className="inline-flex flex-1 items-center justify-center rounded-lg bg-[#DC143C] px-4 py-3 text-sm font-semibold text-white hover:bg-[#c51235]"
            >
              Donate on Ko‑fi
            </a>

            <a
              href="https://ko-fi.com/marekdabrowski"
              target="_blank"
              rel="noreferrer"
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/30 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-900/55"
            >
              Request an indicator
            </a>
          </div>
        </section>

        {/* Direct link to Marek */}
        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/25 p-6">
          <h2 className="text-lg font-semibold">Have an idea? Tell me directly.</h2>
          <p className="mt-2 text-slate-300">
            Found a bug? Want a new indicator? Have feedback?{" "}
            <a
              href="https://ko-fi.com/marekdabrowski"
              target="_blank"
              rel="noreferrer"
              className="text-[#DC143C] underline hover:text-[#DC143C]/80"
            >
              Send me a message on Ko‑fi
            </a>{" "}
            and I'll get back to you with an estimate on when it might land.
          </p>
        </section>

        {/* Footer */}
        <footer className="mt-14 border-t border-slate-800/70 pt-6 text-sm text-slate-400">
          <div>Not financial advice. Always verify alerts on your broker.</div>
          <div className="mt-1">Data delays & limitations</div>
          <div className="mt-1">Contact / Feedback</div>
        </footer>
      </main>
    </div>
  );
}
