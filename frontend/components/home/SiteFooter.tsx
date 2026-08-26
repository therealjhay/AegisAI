import Image from "next/image";
import Link from "next/link";

const platformLinks = [
  { href: "/#pipeline", label: "How it works" },
  { href: "/#console", label: "Command center" },
  { href: "/#trust", label: "Trust model" },
  { href: "/command", label: "Open console" },
];

const fieldDocs = [
  "SYSTEM_MANUAL.md",
  "API_REFERENCE.openapi.yaml",
  "SECURITY.md",
  "DISASTER_RECOVERY.md",
];

export function SiteFooter() {
  return (
    <footer className="bg-navy-deep text-paper">
      <div className="mx-auto max-w-shell px-5 py-16 sm:px-8">
        <div className="grid grid-cols-12 gap-10 border-b border-paper/15 pb-12">
          <div className="col-span-12 lg:col-span-6">
            <div className="flex items-center gap-3">
              <Image
                src="/logo-mark.png"
                alt=""
                width={36}
                height={36}
                className="h-9 w-9"
              />
              <span className="text-lg font-bold tracking-tight">
                AEGIS<span className="text-signal-bright">AI</span>
              </span>
            </div>
            <p className="mt-5 max-w-sm leading-relaxed text-paper/60">
              Defensive, event-driven disaster triage for NGO response — from
              first raw alert to verified field deployment.
            </p>
          </div>

          <nav aria-label="Footer" className="col-span-6 sm:col-span-4 lg:col-span-3">
            <h3 className="mono-label text-[10px] text-paper/45">Platform</h3>
            <ul className="mt-4 space-y-2.5">
              {platformLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-paper/75 transition-colors hover:text-signal-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-bright"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="col-span-6 sm:col-span-4 lg:col-span-3">
            <h3 className="mono-label text-[10px] text-paper/45">Field docs</h3>
            <ul className="mt-4 space-y-2.5">
              {fieldDocs.map((doc) => (
                <li key={doc} className="font-mono text-xs text-paper/55">
                  {doc}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-paper/45">
            © 2026 AegisAI — decision support for humanitarian operations.
          </p>
          <p className="mono-label text-[9px] text-paper/40">
            OSINT in · verified response out
          </p>
        </div>
      </div>
    </footer>
  );
}
