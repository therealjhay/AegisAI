import Image from "next/image";
import Link from "next/link";

const navLinks = [
  { href: "/#pipeline", label: "How it works" },
  { href: "/#console", label: "Console" },
  { href: "/#trust", label: "Trust model" },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-shell items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-3"
          aria-label="AEGIS home"
        >
          <Image
            src="/logo-mark.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8"
            priority
          />
          <span className="text-lg font-bold tracking-tight text-navy">
            AEGIS
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="mono-label text-[11px] text-navy-soft transition-colors hover:text-navy"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <Link
          href="/command"
          className="mono-label bg-signal-bright px-4 py-2.5 text-[11px] font-semibold text-navy-deep transition-colors hover:bg-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
        >
          Open Command Center
        </Link>
      </div>
    </header>
  );
}
