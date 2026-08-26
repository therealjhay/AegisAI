import Image from "next/image";
import Link from "next/link";

const heroStats = [
  { value: "04", label: "Pipeline pillars, intake to audit" },
  { value: "3/4", label: "Agent quorum required to act" },
  { value: "1 km", label: "Duplicate-suppression radius" },
  { value: "100%", label: "Decisions on the audit ledger" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(12,36,72,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(12,36,72,0.045) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />
      <div className="relative mx-auto max-w-shell px-5 pb-16 pt-16 sm:px-8 sm:pt-24 lg:pb-24">
        <div className="grid grid-cols-12 gap-10 lg:gap-8">
          <div className="col-span-12 flex flex-col justify-center lg:col-span-7">
            <p className="mono-label flex items-center gap-2.5 text-[11px] text-navy-soft">
              <span aria-hidden="true" className="inline-block h-2 w-2 bg-signal" />
              NGO disaster-triage platform
            </p>
            <h1 className="mt-6 max-w-[13ch] text-balance text-5xl font-bold leading-[1.02] tracking-tight text-navy sm:text-6xl lg:text-7xl">
              Raw reports in. Verified response out.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-navy-soft">
              AEGIS ingests incident reports from SMS, social feeds and
              partner relays, clusters them geographically, and puts every
              cluster before a four-agent AI quorum. When 3-of-4 agents sign
              off, the vault releases parametric USDC funding — and every
              vote, hash and transaction stays on the record.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/command"
                className="mono-label bg-signal-bright px-6 py-3.5 text-xs font-semibold text-navy-deep transition-colors hover:bg-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
              >
                Open Command Center
              </Link>
              <a
                href="#pipeline"
                className="mono-label border border-navy/25 px-6 py-3.5 text-xs font-semibold text-navy transition-colors hover:border-navy hover:bg-navy hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
              >
                How it works
              </a>
            </div>
            <p className="mono-label mt-12 hidden text-[10px] text-navy-soft/80 lg:block">
              PostGIS core · FastAPI triage brain · 4-agent swarm quorum ·
              parametric USDC vault
            </p>
          </div>

          <div className="col-span-12 flex items-center justify-center lg:col-span-5">
            <figure className="relative w-full max-w-sm border border-line bg-paper-raised p-8 shadow-[6px_6px_0_0_rgba(12,36,72,0.08)]">
              <span aria-hidden="true" className="absolute -left-px -top-px h-4 w-4 border-l-2 border-t-2 border-navy" />
              <span aria-hidden="true" className="absolute -right-px -top-px h-4 w-4 border-r-2 border-t-2 border-navy" />
              <span aria-hidden="true" className="absolute -bottom-px -left-px h-4 w-4 border-b-2 border-l-2 border-navy" />
              <span aria-hidden="true" className="absolute -bottom-px -right-px h-4 w-4 border-b-2 border-r-2 border-navy" />
              <div className="flex items-center justify-center p-4">
                <Image
                  src="/logo-mark.png"
                  alt="AEGIS shield mark — a navy shield enclosing an orange signal mesh"
                  width={320}
                  height={320}
                  priority
                  className="h-auto w-full max-w-[280px]"
                />
              </div>
              <figcaption className="mono-label mt-6 border-t border-line pt-4 text-[10px] leading-relaxed text-navy-soft">
                Fig. 01 — The shield verifies. The mesh signals.
              </figcaption>
            </figure>
          </div>
        </div>

        <dl className="mt-16 grid grid-cols-2 border-t border-navy/15 lg:mt-20 lg:grid-cols-4">
          {heroStats.map((stat, i) => (
            <div
              key={stat.label}
              className={`border-navy/15 px-1 py-6 sm:px-6 ${
                i > 0 ? "border-l max-lg:[&:nth-child(3)]:border-l-0" : ""
              } max-lg:[&:nth-child(n+3)]:border-t`}
            >
              <dt className="mono-label order-2 mt-2 text-[10px] leading-relaxed text-navy-soft">
                {stat.label}
              </dt>
              <dd className="order-1 font-mono text-3xl font-semibold tabular-nums text-navy">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
