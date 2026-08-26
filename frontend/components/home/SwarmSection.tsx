import { IconPin, IconPulse, IconSearch, IconShield } from "@/components/icons";

const agents = [
  {
    number: "01",
    name: "Triangulator",
    question: "Is this one real incident?",
    icon: <IconPin width={18} height={18} />,
    body: "Scores geographic coherence before anything else: how many reports arrived, how tightly they cluster, and how many independent sources agree. Four reports within 300 metres from three sources score well. A single anonymous tip smeared across 800 metres does not.",
    proofs: ["Report count", "Cluster radius", "Source spread"],
  },
  {
    number: "02",
    name: "Fact-Checker",
    question: "Does the outside world confirm it?",
    icon: <IconSearch width={18} height={18} />,
    body: "Cross-examines the cluster against news scans, Sentinel-2 satellite imagery and weather anomalies — a claim must survive external evidence, not just internal agreement. Violent-incident claims need news corroboration within the hour, or the agent votes no and forces an audit.",
    proofs: ["News scan", "Satellite imagery", "Weather anomaly"],
  },
  {
    number: "03",
    name: "Triage Evaluator",
    question: "How bad is it, really?",
    icon: <IconPulse width={18} height={18} />,
    body: "Reads the raw reports and sets severity tier 1–4 from threat-to-life language, then sizes the funding request to match. Casualty and infrastructure language raises the tier; exaggeration without evidence does not.",
    proofs: ["Severity tier", "Max urgency", "Sized request"],
  },
  {
    number: "04",
    name: "Risk Governor",
    question: "How much will we actually release?",
    icon: <IconShield width={18} height={18} />,
    body: "The last word on money. Applies tier hard caps against vault reserves and daily limits, rounds down to the safe amount — and can veto the entire release to zero. Even a unanimous vote moves nothing past its cap.",
    proofs: ["Tier hard cap", "Daily limit", "Vault reserve"],
  },
];

const mechanics = [
  {
    step: "1",
    title: "Independent votes",
    body: "All four agents judge the same cluster in parallel. Each sees only its own mandate — geography, evidence, severity, or money.",
  },
  {
    step: "2",
    title: "Signed & sealed",
    body: "Every vote is HMAC-signed with that agent's secret key and attached to its tool proofs. Tampering breaks the signature.",
  },
  {
    step: "3",
    title: "3-of-4 threshold",
    body: "Three YES votes are required to act. Two NO votes quarantine the cluster outright — no review queue, no funding.",
  },
  {
    step: "4",
    title: "Quorum hash",
    body: "The sorted vote set is hashed into a single SHA-256 fingerprint and committed to the cluster record.",
  },
  {
    step: "5",
    title: "Capped release",
    body: "Only the Governor's effective amount can ever be disbursed. Quorum alone is not enough — the cap rules.",
  },
];

export function SwarmSection() {
  return (
    <section id="swarm" className="scroll-mt-20 border-b border-line bg-paper">
      <div className="mx-auto max-w-shell px-5 py-20 sm:px-8 lg:py-28">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mono-label flex items-center gap-2.5 text-[11px] text-navy-soft">
              <span aria-hidden="true" className="inline-block h-2 w-2 bg-signal" />
              The multi-agent core
            </p>
            <h2 className="mt-5 max-w-[18ch] text-balance text-4xl font-bold leading-[1.05] tracking-tight text-navy sm:text-5xl">
              Nothing moves until four agents agree.
            </h2>
          </div>
          <p className="max-w-md text-base leading-relaxed text-navy-soft">
            AegisAI has no single AI authority and no rubber stamp. Every
            incident is judged by four independent agents — each with its own
            mandate, its own tools and its own cryptographic signature. The
            platform cannot verify, prioritize or pay without them.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-px border border-line bg-line md:grid-cols-2 xl:grid-cols-4">
          {agents.map((agent) => (
            <article key={agent.name} className="flex flex-col bg-paper-raised p-6 lg:p-7">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold text-signal">
                  / {agent.number}
                </span>
                <span className="text-navy-soft">{agent.icon}</span>
              </div>
              <h3 className="mt-5 text-lg font-bold tracking-tight text-navy">
                {agent.name}
              </h3>
              <p className="mono-label mt-1.5 text-[9px] leading-relaxed text-signal">
                {agent.question}
              </p>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-navy-soft">
                {agent.body}
              </p>
              <div className="mt-6 border-t border-line pt-4">
                <p className="mono-label text-[8px] text-muted-foreground">Tool proofs</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {agent.proofs.map((proof) => (
                    <li
                      key={proof}
                      className="mono-label border border-line-strong px-2 py-1 text-[8px] text-navy-soft"
                    >
                      {proof}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-16 border-y border-navy/15 py-12 lg:py-14">
          <p className="mono-label text-[10px] text-navy-soft">How a decision is made</p>
          <ol className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3 xl:grid-cols-5">
            {mechanics.map((m, i) => (
              <li key={m.step} className="relative">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-2xl font-semibold text-navy/20">
                    {m.step}
                  </span>
                  {i < mechanics.length - 1 && (
                    <span aria-hidden="true" className="hidden font-mono text-navy/25 xl:absolute xl:-right-4 xl:top-1 xl:block">
                      →
                    </span>
                  )}
                </div>
                <h3 className="mt-3 text-sm font-bold tracking-tight text-navy">
                  {m.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-navy-soft">
                  {m.body}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <p className="mx-auto mt-14 max-w-3xl text-center text-2xl font-bold leading-snug tracking-tight text-navy sm:text-3xl">
          If the swarm doesn&rsquo;t verify, AegisAI doesn&rsquo;t act.{" "}
          <span className="text-navy-soft">No human can skip it.</span>{" "}
          <span className="text-signal">No single agent can force it.</span>
        </p>
      </div>
    </section>
  );
}
