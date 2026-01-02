import React, { useMemo, useState } from "react";
import HussarImage from "./components/Hussar.jpeg";

type Props = {
  onOpenChart: () => void;
  onLoginClick?: () => void;
  onGoogleClick?: () => void;
  onEmailClick?: () => void;
};

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name:
    | "watchlist"
    | "alerts"
    | "layouts"
    | "indicators"
    | "realtime"
    | "crosshair"
    | "compare"
    | "heart"
    | "spark";
  className?: string;
}) {
  const common = { className, fill: "none", stroke: "currentColor", strokeWidth: 1.8 };
  switch (name) {
    case "watchlist":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
        </svg>
      );
    case "alerts":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a3 3 0 0 0 6 0" />
        </svg>
      );
    case "layouts":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16v16H4z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 9h16M9 4v16" />
        </svg>
      );
    case "indicators":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 15l3-3 3 2 4-6" />
        </svg>
      );
    case "realtime":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 12h4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 12h4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 17l10-10" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 8h0" />
        </svg>
      );
    case "crosshair":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v5M12 17v5M2 12h5M17 12h5" />
          <circle cx="12" cy="12" r="4.5" />
        </svg>
      );
    case "compare":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 6v12" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 21s-7-4.6-9.2-8.4C1.2 9.6 3.1 6.5 6.2 6.1c1.7-.2 3.3.6 4.3 1.9 1-1.3 2.6-2.1 4.3-1.9 3.1.4 5 3.5 3.4 6.5C19 16.4 12 21 12 21z"
          />
        </svg>
      );
    case "spark":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l1.2 4.2L17.4 8 13.2 9.2 12 13.4 10.8 9.2 6.6 8l4.2-1.8L12 2z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 13l.8 2.8 2.2.7-2.2.8L19 20l-.8-2.7-2.2-.8 2.2-.7L19 13z" />
        </svg>
      );
    default:
      return null;
  }
}

export default function LandingPage({
  onOpenChart,
  onLoginClick,
  onGoogleClick,
  onEmailClick,
}: Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = useMemo(
    () => [
      {
        title: "Watchlist + search",
        desc: "Find symbols fast, manage your watch list, drag to reorder. Syncs to cloud when signed in.",
        icon: "watchlist" as const,
      },
      {
        title: "Alerts: create / mute / delete",
        desc: "Manage alert noise without losing setups. Triggered count badge. Full control over what fires.",
        icon: "alerts" as const,
      },
      {
        title: "Layouts: save and reload setups",
        desc: "Swap indicator bundles instantly. Save your best trading setups and load them one click.",
        icon: "layouts" as const,
      },
      {
        title: "Overlay + oscillator indicators",
        desc: "Signals overlaid on price + dedicated panes below. Works with any Pine indicator logic.",
        icon: "indicators" as const,
      },
      {
        title: "WebSocket or polling mode",
        desc: "Choose real-time streaming or reliable polling refresh. Toggle between modes anytime.",
        icon: "realtime" as const,
      },
      {
        title: "Crosshair + synced panes",
        desc: "Read values across all panes at the exact same time. Professional crosshair interaction.",
        icon: "crosshair" as const,
      },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-[#0b1220] text-slate-100">
      {/* Subtle background texture */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.18) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-slate-800/70 bg-[#0b1220]/85 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-bold tracking-tight text-white">⚔</div>
            <div className="leading-tight">
              <div className="text-lg font-semibold tracking-tight text-white">PolishedCharts</div>
              <div className="text-xs text-slate-400">by Marek (solo dev, Poland)</div>
            </div>
          </div>

          <div className="hidden flex-1 items-center justify-end gap-3 md:flex">
            <button
              onClick={onLoginClick}
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Log in
            </button>
            <a
              href="https://ko-fi.com/marekdabrowski"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-[#DC143C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#DC143C]/15 transition-colors"
            >
              Support Marek (Ko‑fi)
            </a>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-slate-300 hover:text-white"
            aria-label="Open menu"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-800 bg-[#0b1220] px-6 py-3 md:hidden">
            <button
              onClick={() => {
                onLoginClick?.();
                setMobileMenuOpen(false);
              }}
              className="block w-full text-left text-sm text-slate-300 hover:text-white py-2"
            >
              Log in
            </button>
            <a
              href="https://ko-fi.com/marekdabrowski"
              target="_blank"
              rel="noreferrer"
              className="block w-full text-left text-sm text-slate-300 hover:text-white py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Support Marek (Ko‑fi)
            </a>
          </div>
        )}
      </header>

      <main className="relative mx-auto max-w-screen-2xl px-6 py-14 lg:px-10 lg:py-20">
        {/* HERO: wide 3-column layout */}
        <section className="mb-20">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
            {/* Left (copy) */}
            <div className="lg:col-span-4">
              <h1 className="text-5xl font-bold leading-tight tracking-tight text-white sm:text-6xl">
                Custom-indicator alerts without insane limits
              </h1>

              <p className="mt-6 text-xl leading-relaxed text-slate-300">
                Built to trigger alerts from non-standard Pine indicators—so you can stop paying
                "pro" pricing just to run more alerts.
              </p>

              <div className="mt-8 flex flex-col gap-4">
                <button
                  onClick={onOpenChart}
                  className="w-full rounded-xl bg-[#DC143C] px-8 py-5 text-xl font-bold tracking-wide text-white hover:bg-[#c51235] transition-all duration-200 shadow-lg hover:shadow-[#DC143C]/45"
                >
                  OPEN THE CHART
                </button>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={onGoogleClick}
                    className="rounded-lg border border-slate-700 bg-slate-900/30 px-6 py-3 text-base font-semibold text-slate-100 hover:bg-slate-900/55 transition-colors"
                  >
                    Sign in with Google
                  </button>
                  <button
                    onClick={onEmailClick}
                    className="rounded-lg border border-slate-700 bg-slate-900/20 px-6 py-3 text-base font-semibold text-slate-100 hover:bg-slate-900/45 transition-colors"
                  >
                    Email login
                  </button>
                </div>

                <a
                  href="https://ko-fi.com/marekdabrowski"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-slate-300 underline underline-offset-4 hover:text-white transition-colors"
                >
                  → Request an indicator for $1+ support
                </a>

                {/* Small “value chips” to fill space + add structure */}
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/25 px-4 py-3">
                    <div className="text-xs text-slate-400">Limits</div>
                    <div className="mt-1 text-sm font-semibold text-white">Unlimited alerts</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/25 px-4 py-3">
                    <div className="text-xs text-slate-400">Indicators</div>
                    <div className="mt-1 text-sm font-semibold text-white">Custom Pine logic</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/25 px-4 py-3">
                    <div className="text-xs text-slate-400">Layouts</div>
                    <div className="mt-1 text-sm font-semibold text-white">Save & reload</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle (monetization cards) */}
            <div className="lg:col-span-3">
              <div className="space-y-4">
                {/* Membership */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/40 border border-slate-800">
                        <span className="text-slate-200">
                          <Icon name="spark" className="h-5 w-5" />
                        </span>
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-white">Optional Membership</div>
                        <div className="text-xs text-slate-400">Support + priority</div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-[#DC143C]">from $3/mo</div>
                  </div>

                  <ul className="mt-4 space-y-2 text-sm text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center justify-center text-xs">
                        ✓
                      </span>
                      <span>Unlimited watchlists (synced to cloud)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center justify-center text-xs">
                        ✓
                      </span>
                      <span>Unlimited alerts & alarms</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center justify-center text-xs">
                        ✓
                      </span>
                      <span>Priority indicator requests</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center justify-center text-xs">
                        ✓
                      </span>
                      <span>Helps fund real-time data</span>
                    </li>
                  </ul>

                  <a
                    href="https://ko-fi.com/marekdabrowski"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 block w-full rounded-xl bg-[#DC143C] px-4 py-3 text-center text-sm font-semibold text-white hover:bg-[#c51235] transition-colors"
                  >
                    Become a member
                  </a>
                </div>

                {/* One-time donation */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/25 p-6">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/40 border border-slate-800">
                      <span className="text-slate-200">
                        <Icon name="heart" className="h-5 w-5" />
                      </span>
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">One-time Donation</div>
                      <div className="mt-1 text-sm text-slate-300">
                        Building this solo takes time. Even $1 helps keep servers running.
                      </div>
                    </div>
                  </div>

                  <a
                    href="https://ko-fi.com/marekdabrowski"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-slate-700 bg-slate-900/15 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-900/35 transition-colors"
                  >
                    Donate on Ko‑fi
                  </a>
                </div>

                {/* Data source notice - PROMINENT */}
                <div className="rounded-xl border-2 border-amber-500/70 bg-amber-500/15 px-5 py-6">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500">
                      <span className="text-lg font-bold">⏱</span>
                    </span>
                    <div className="flex-1">
                      <div className="text-lg font-bold text-amber-300">~15 Minute Data Delay</div>
                      <div className="mt-2 text-sm text-amber-200/90 leading-relaxed">
                        Great for daily/longer-term charts. For short-term trading, be aware of the delay.
                        Real-time data is a future goal—funding needed.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right (visual) */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/25 p-6 lg:p-8">
                <div className="text-center">
                  <div className="text-base font-semibold text-white">Built in Poland with Love</div>
                </div>

                <div className="mt-6 flex justify-center">
                  <img src={HussarImage} alt="Polish Hussar made of candlesticks" className="w-full h-auto" />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/25 px-4 py-3">
                    <div className="text-xs text-slate-400">Focus</div>
                    <div className="mt-1 text-sm font-semibold text-white">Alerts at scale</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/25 px-4 py-3">
                    <div className="text-xs text-slate-400">Goal</div>
                    <div className="mt-1 text-sm font-semibold text-white">Real-time data</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mb-20">
          <div className="mx-auto max-w-5xl text-center">
            <h2 className="text-4xl font-bold text-white">What's Already Built</h2>
            <p className="mt-3 text-lg text-slate-300">
              The core workflow is live—charting, indicators, alerts, and layouts.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="h-full rounded-2xl border border-slate-800 bg-slate-900/25 p-6 hover:bg-slate-900/35 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40 text-slate-200">
                    <Icon name={f.icon} className="h-5 w-5" />
                  </span>
                  <h3 className="text-base font-semibold text-white">{f.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Why this exists + comparison */}
        <section className="mb-20 rounded-3xl border border-slate-800 bg-slate-900/30 p-8 lg:p-12">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-7">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40 text-slate-200">
                  <Icon name="compare" className="h-5 w-5" />
                </span>
                <h2 className="text-3xl font-bold text-white">Why This Exists</h2>
              </div>

              <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-300">
                <p>
                  <strong>Other platforms often gate higher alert counts behind expensive tiers.</strong> Want alerts
                  on custom Pine logic? The pricing often jumps fast.
                </p>
                <p>
                  <strong>This project stays lean:</strong> the app remains usable for free, while supporters help fund
                  servers, data providers, and development time.
                </p>
                <p>
                  <strong>Charging something is fair</strong>—but it should stay reasonable and not feel punitive.
                </p>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-slate-800 bg-[#0b1220]/60 p-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-white">Quick comparison</div>
                  <div className="text-xs text-slate-400">High-level</div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/25 p-4">
                    <div className="text-xs text-slate-400">Typical “pro” tiers</div>
                    <ul className="mt-3 space-y-2 text-sm text-slate-300">
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 text-slate-500">•</span>
                        <span>Alert caps or high tiers</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 text-slate-500">•</span>
                        <span>Pay more for “unlimited”</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 text-slate-500">•</span>
                        <span>Feature gating by plan</span>
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-[#DC143C]/35 bg-[#DC143C]/10 p-4">
                    <div className="text-xs text-slate-200">PolishedCharts</div>
                    <ul className="mt-3 space-y-2 text-sm text-slate-200">
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 text-emerald-300">✓</span>
                        <span>Unlimited alerts</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 text-emerald-300">✓</span>
                        <span>Custom-indicator focus</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5 text-emerald-300">✓</span>
                        <span>Support funds growth</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <a
                  href="https://ko-fi.com/marekdabrowski"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#DC143C] px-4 py-3 text-sm font-semibold text-white hover:bg-[#c51235] transition-colors"
                >
                  Support development
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Support */}
        <section className="mb-20 rounded-3xl border border-[#DC143C]/40 bg-[#DC143C]/10 p-10 lg:p-14">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-4xl font-bold text-white">One-man show (Marek)</h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-200">
              Built solo in Poland. If you support with even $1 and need an indicator added, send the request and I’ll
              do my best to add it. More support = faster development = real-time data eventually.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <a
                href="https://ko-fi.com/marekdabrowski"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl bg-[#DC143C] px-6 py-4 text-base font-semibold text-white hover:bg-[#c51235] transition-colors"
              >
                Support on Ko‑fi
              </a>

              <a
                href="https://ko-fi.com/marekdabrowski"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900/25 px-6 py-4 text-base font-semibold text-white hover:bg-slate-900/45 transition-colors"
              >
                Request an indicator
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-800/70 pt-10 pb-8">
          <div className="mx-auto max-w-4xl space-y-3 text-sm text-slate-400">
            <p>
              <strong>Not financial advice.</strong> Always verify alerts on your broker before acting on them. Alerts
              may be delayed due to data sources.
            </p>
            <p>
              <strong>Data delays &amp; limitations:</strong> Currently using Yahoo Finance (typically ~15 min delay).
              Real-time data is a future goal requiring investment.
            </p>
            <p>
              <strong>Contact / Feedback:</strong> Support the project on Ko‑fi or reach out through the app.
            </p>
          </div>

          <div className="mx-auto mt-7 max-w-4xl border-t border-slate-800/40 pt-6 text-xs text-slate-500">
            <p>© 2025 PolishedCharts by Marek. Made in Poland with ⚔ for traders who refuse to pay insane platform fees.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}

