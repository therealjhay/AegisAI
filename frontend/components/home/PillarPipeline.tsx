const quorumAgents = [
  { name: "Triangulator", role: "Geography & clustering", vote: "YES", score: 0.91 },
  { name: "Fact-Checker", role: "News · satellite · weather", vote: "YES", score: 0.84 },
  { name: "Triage Analyst", role: "Urgency 1–5", vote: "YES", score: 0.88 },
  { name: "Risk Governor", role: "Tier caps & vault limits", vote: "YES", score: 0.79 },
];

function IntakeMock() {
  return (
    <div className="border border-navy-deep bg-navy-ink p-5 font-mono text-[12px] leading-6 text-paper/85">
      <p className="text-paper/40">POST /api/ingest</p>
      <p>
        <span className="text-signal-bright">INGEST</span> #a91f src:sms-relay cred:0.82
      </p>
      <p>
        <span className="text-signal-bright">GEO</span> 11.83°N 13.15°E → cluster maiduguri-01
      </p>
      <p>
        <span className="text-signal-bright">DEDUP</span> 0 hits within 1 km / 60 min
      </p>
      <p>
        <span className="text-signal-bright">TRIAGE</span> type:flood urgency:4
        loc:{'"'}Maiduguri Market{'"'}
      </p>
      <p className="mt-2 border-t border-paper/15 pt-2">
        STATUS <span className="bg-signal-bright px-1.5 py-0.5 font-semibold text-navy-deep">ACCEPTED</span> → queued for swarm quorum
      </p>
    </div>
  );
}

function QuorumMock() {
  return (
    <div className="border border-navy-deep bg-navy-ink p-5 font-mono text-[12px] text-paper/85">
      <p className="text-paper/40">POST /api/swarm/verify — cluster maiduguri-01</p>
      <ul className="mt-3 space-y-2">
        {quorumAgents.map((agent) => (
          <li key={agent.name} className="flex items-center gap-3">
            <span
              className={`w-11 shrink-0 px-1 py-0.5 text-center text-[10px] font-semibold ${
                agent.vote === "YES"
                  ? "bg-paper text-navy-ink"
                  : "bg-signal-deep text-paper"
              }`}
            >
              {agent.vote}
            </span>
            <span className="w-28 shrink-0 truncate text-paper">{agent.name}</span>
            <span className="hidden w-44 shrink-0 truncate text-paper/45 sm:block">
              {agent.role}
            </span>
            <span className="ml-auto tabular-nums text-signal-bright">
              {agent.score.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-paper/15 pt-2">
        QUORUM <span className="text-signal-bright">3/4 YES</span> — reached · sig
        0x7f3a…c21e <span className="bg-signal-bright px-1.5 py-0.5 font-semibold text-navy-deep">VERIFIED</span>
      </p>
    </div>
  );
}

function SettlementMock() {
  return (
    <div className="border border-navy-deep bg-navy-ink p-5 font-mono text-[12px] text-paper/85">
      <p className="text-paper/40">POST /api/vault/disburse</p>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        <span className="text-paper/45">Tier</span>
        <span className="text-right text-paper">T2 — severe</span>
        <span className="text-paper/45">Governor cap</span>
        <span className="text-right tabular-nums text-signal-bright">$68,000</span>
        <span className="text-paper/45">Asset</span>
        <span className="text-right text-paper">USDC (SPL)</span>
        <span className="text-paper/45">Signatures</span>
        <span className="text-right text-paper">3-of-4 verified</span>
      </div>
      <p className="mt-3 border-t border-paper/15 pt-2">
        TX 5Kj9…pQ2m <span className="bg-signal-bright px-1.5 py-0.5 font-semibold text-navy-deep">CONFIRMED</span>
      </p>
    </div>
  );
}

function AuditMock() {
  return (
    <div className="border border-navy-deep bg-navy-ink p-5 font-mono text-[12px] text-paper/85">
      <p className="text-paper/40">GET /api/audit/maiduguri-01</p>
      <ul className="mt-3 space-y-2">
        <li className="flex justify-between gap-4">
          <span className="text-paper/45">vote.triangulator</span>
          <span className="truncate text-paper">sig 9f2b…44a1</span>
        </li>
        <li className="flex justify-between gap-4">
          <span className="text-paper/45">vote.fact_checker</span>
          <span className="truncate text-paper">sig c70d…e392</span>
        </li>
        <li className="flex justify-between gap-4">
          <span className="text-paper/45">quorum.hash</span>
          <span className="truncate text-signal-bright">0x7f3a…c21e</span>
        </li>
        <li className="flex justify-between gap-4">
          <span className="text-paper/45">disbursement.tx</span>
          <span className="truncate text-paper">5Kj9…pQ2m</span>
        </li>
      </ul>
      <p className="mt-3 border-t border-paper/15 pt-2">
        REPLAY <span className="text-signal-bright">every decision traceable, end to end</span>
      </p>
    </div>
  );
}

const pillars = [
  {
    number: "01",
    kicker: "Intake & clustering",
    title: "A skeptic sits at the door.",
    body: "Raw reports arrive from SMS, social feeds, partner relays and operator entry. Each payload is schema-validated, its source credibility scored, and near-duplicates within one kilometre of the past hour suppressed. Anything suspicious is quarantined for analyst review — never shown to operators as fact. Accepted reports are clustered geographically into Incident Clusters on the PostGIS core.",
    chips: ["Zod validation", "Credibility scoring", "1 km / 60 min dedup", "Quarantine routing"],
    Mock: IntakeMock,
  },
  {
    number: "02",
    kicker: "Swarm verification",
    title: "Four agents. One vote each.",
    body: "Every cluster faces an independent quorum: the Triangulator checks geography, the Fact-Checker pulls news, satellite and weather proofs, the Triage Analyst scores threat to life, and the Risk Governor applies tier caps. Each vote is cryptographically signed with tool proofs attached, and three YES votes are required before anything moves.",
    chips: ["Signed votes", "Tool-backed proofs", "3-of-4 quorum", "Quorum hash committed"],
    Mock: QuorumMock,
  },
  {
    number: "03",
    kicker: "Parametric settlement",
    title: "Funding sized by rule, not adrenaline.",
    body: "When quorum is reached, the Risk Governor's tier model caps the release amount — the vault never improvises. A parametric USDC transfer executes on-chain to the responder organisation, with the transaction signature and explorer link recorded against the cluster. No wallet moves faster than the rules.",
    chips: ["Tier-based caps", "On-chain USDC", "Responder wallets", "Explorer-linked"],
    Mock: SettlementMock,
  },
  {
    number: "04",
    kicker: "Verifiable audit trail",
    title: "Every decision, replayable.",
    body: "Votes, signatures, quorum hashes and disbursements persist as a connected trail. After-action reviews can replay exactly which agent said what, on which proof, and where the money went — the accountability donors and NGOs both need. Decision support stays support: humans hold the launch gate.",
    chips: ["Vote history", "Hash chain", "Donor accountability", "Human decision gate"],
    Mock: AuditMock,
  },
];

export function PillarPipeline() {
  return (
    <section id="pipeline" className="scroll-mt-20 border-b border-line bg-paper-raised">
      <div className="mx-auto max-w-shell px-5 py-20 sm:px-8 lg:py-28">
        <div className="flex flex-col gap-6 border-b border-navy/15 pb-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mono-label flex items-center gap-2.5 text-[11px] text-navy-soft">
              <span aria-hidden="true" className="inline-block h-2 w-2 bg-signal" />
              How it works
            </p>
            <h2 className="mt-5 max-w-[20ch] text-balance text-4xl font-bold leading-[1.05] tracking-tight text-navy sm:text-5xl">
              From noisy signal to signed disbursement.
            </h2>
          </div>
          <p className="max-w-md text-base leading-relaxed text-navy-soft">
            Four pillars carry every incident from first report to funded
            response. Each one narrows the noise; none of them skips the
            record.
          </p>
        </div>

        <div className="divide-y divide-line">
          {pillars.map((pillar, i) => (
            <article
              key={pillar.number}
              className="grid grid-cols-12 gap-8 py-14 lg:gap-14 lg:py-20"
            >
              <div
                className={`col-span-12 flex flex-col justify-center lg:col-span-5 ${
                  i % 2 === 1 ? "lg:order-2" : ""
                }`}
              >
                <p className="font-mono text-sm font-semibold text-signal">
                  / {pillar.number}
                </p>
                <p className="mono-label mt-3 text-[10px] text-navy-soft">
                  {pillar.kicker}
                </p>
                <h3 className="mt-3 max-w-[16ch] text-balance text-3xl font-bold tracking-tight text-navy">
                  {pillar.title}
                </h3>
                <p className="mt-5 max-w-lg leading-relaxed text-navy-soft">
                  {pillar.body}
                </p>
                <ul className="mt-7 flex flex-wrap gap-2">
                  {pillar.chips.map((chip) => (
                    <li
                      key={chip}
                      className="mono-label border border-line-strong px-2.5 py-1.5 text-[9px] text-navy-soft"
                    >
                      {chip}
                    </li>
                  ))}
                </ul>
              </div>
              <div
                className={`col-span-12 flex items-center lg:col-span-7 ${
                  i % 2 === 1 ? "lg:order-1" : ""
                }`}
              >
                <div className="w-full shadow-[8px_8px_0_0_rgba(12,36,72,0.10)]">
                  <pillar.Mock />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
