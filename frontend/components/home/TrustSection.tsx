const principles = [
  {
    number: "01",
    title: "Unverified never ships",
    body: "Operators only see what passed the gate. Low-trust sources, malformed payloads and duplicates are routed to quarantine for analyst review — never rendered as fact on the map.",
  },
  {
    number: "02",
    title: "Humans hold the launch gate",
    body: "Urgency scores, credibility ratings and quorum verdicts are decision support. Command staff review context before any team is assigned — no mission launches from a single unverified data point.",
  },
  {
    number: "03",
    title: "Built for the adversarial case",
    body: "Disasters attract misinformation. Duplicate suppression, source-credibility scoring, quarantine routing and anti-honey-pot safeguards are core pipeline stages — not afterthoughts.",
  },
];

export function TrustSection() {
  return (
    <section id="trust" className="scroll-mt-20 border-b border-line">
      <div className="mx-auto max-w-shell px-5 py-20 sm:px-8 lg:py-28">
        <div className="flex flex-col gap-6 border-b border-navy/15 pb-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mono-label flex items-center gap-2.5 text-[11px] text-navy-soft">
              <span aria-hidden="true" className="inline-block h-2 w-2 bg-signal" />
              Trust model
            </p>
            <h2 className="mt-5 max-w-[22ch] text-balance text-4xl font-bold leading-[1.05] tracking-tight text-navy sm:text-5xl">
              Verification-first is the discipline.
            </h2>
          </div>
          <p className="max-w-md text-base leading-relaxed text-navy-soft">
            An NGO stakes its reputation on every deployment. AegisAI is
            engineered so the system can be wrong safely — and never silently.
          </p>
        </div>

        <ol className="grid grid-cols-1 gap-px bg-line md:grid-cols-3">
          {principles.map((p) => (
            <li key={p.number} className="bg-paper p-8 lg:p-10">
              <p className="font-mono text-sm font-semibold text-signal">
                {p.number}
              </p>
              <h3 className="mt-4 text-xl font-bold tracking-tight text-navy">
                {p.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-navy-soft">
                {p.body}
              </p>
            </li>
          ))}
        </ol>

        <p className="mono-label mt-8 text-[10px] text-navy-soft/80">
          Security controls detailed in SECURITY.md · anti-honey-pot misuse
          safeguards · operator access limited to need-to-know roles
        </p>
      </div>
    </section>
  );
}
