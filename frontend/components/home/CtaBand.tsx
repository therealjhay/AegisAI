import Link from "next/link";
import Image from "next/image";

export function CtaBand() {
  return (
    <section className="bg-navy text-paper">
      <div className="mx-auto max-w-shell px-5 py-20 sm:px-8 lg:py-24">
        <div className="flex flex-col items-start gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-6">
            <Image
              src="/logo-mark.png"
              alt=""
              width={72}
              height={72}
              className="hidden h-20 w-20 shrink-0 sm:block"
            />
            <div>
              <h2 className="max-w-[24ch] text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                When the next report breaks, be the team that already verified
                it.
              </h2>
              <p className="mono-label mt-5 text-[10px] text-paper/55">
                PostGIS core · FastAPI triage brain · Next.js console ·
                self-hostable end to end
              </p>
            </div>
          </div>
          <Link
            href="/command"
            className="mono-label shrink-0 bg-signal-bright px-8 py-4 text-xs font-semibold text-navy-deep transition-colors hover:bg-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-bright"
          >
            Open Command Center
          </Link>
        </div>
      </div>
    </section>
  );
}
