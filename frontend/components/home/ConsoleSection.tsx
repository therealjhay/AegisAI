import Link from "next/link";

const capabilities = [
  {
    name: "Live incident heatmap",
    detail: "Mapbox GL rendering of verified clusters, weighted by urgency score.",
  },
  {
    name: "Priority sidebar",
    detail: "Top urgent verified alerts first, with funding deficit per incident.",
  },
  {
    name: "Sector filters",
    detail: "Isolate medical, shelter, water, rescue and logistics slices in one click.",
  },
  {
    name: "Swarm · vault · audit panels",
    detail: "Run the quorum, execute the capped disbursement, inspect the trail — in place.",
  },
];

export function ConsoleSection() {
  return (
    <section id="console" className="scroll-mt-20 border-b border-navy-deep bg-navy-ink text-paper">
      <div className="mx-auto max-w-shell px-5 py-20 sm:px-8 lg:py-28">
        <div className="grid grid-cols-12 gap-10 lg:gap-14">
          <div className="col-span-12 lg:col-span-5">
            <p className="mono-label flex items-center gap-2.5 text-[11px] text-paper/60">
              <span aria-hidden="true" className="inline-block h-2 w-2 bg-signal-bright" />
              Inside the command center
            </p>
            <h2 className="mt-5 text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
              One screen. Where the response begins.
            </h2>
            <p className="mt-6 max-w-md leading-relaxed text-paper/70">
              Verified intelligence is only useful if operators can act on it
              in seconds. The command center puts the map, the priorities and
              the money on a single dark console — built for long shifts and
              bad days.
            </p>
            <Link
              href="/command"
              className="mono-label mt-9 inline-block bg-signal-bright px-6 py-3.5 text-xs font-semibold text-navy-deep transition-colors hover:bg-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-bright"
            >
              Open the console
            </Link>
          </div>

          <ul className="col-span-12 grid grid-cols-1 gap-px border border-paper/15 bg-paper/15 sm:grid-cols-2 lg:col-span-7">
            {capabilities.map((cap, i) => (
              <li key={cap.name} className="bg-navy-ink p-6 lg:p-8">
                <p className="font-mono text-xs text-signal-bright">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-3 text-lg font-semibold text-paper">
                  {cap.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-paper/60">
                  {cap.detail}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
