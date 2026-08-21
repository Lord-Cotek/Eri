import Link from "next/link";
import { EriMark } from "@/components/ui/EriMark";
import { CotekEyebrow } from "@/components/ui";

/**
 * The frame every signed-in surface sits in.
 *
 * The navigation deliberately does not show a count of anything. A badge on
 * "ally" would leak that something is pending, and the ally sees nothing during
 * the grace window.
 */

const LINKS: { href: string; label: string }[] = [
  { href: "/subject", label: "You" },
  { href: "/ally", label: "Ally" },
  { href: "/devices", label: "Devices" },
  { href: "/settings", label: "Settings" },
];

export function Shell({
  children,
  active,
  showSimulator = false,
}: {
  children: React.ReactNode;
  active?: string;
  showSimulator?: boolean;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-5">
          <Link href="/" className="flex items-center gap-3 text-ink transition-colors hover:text-steel">
            <EriMark size={22} className="text-steel" title="Ẹ̀rí" />
            <span className="font-serif text-lg">Ẹ̀rí</span>
          </Link>

          <nav className="flex items-center gap-5 text-xs uppercase tracking-[0.15em]">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  active === link.href
                    ? "text-steel"
                    : "text-muted transition-colors hover:text-ink"
                }
              >
                {link.label}
              </Link>
            ))}
            {showSimulator && (
              <Link href="/simulator" className="text-muted transition-colors hover:text-ink">
                Simulator
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">{children}</main>

      <footer className="mt-20 border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <CotekEyebrow />
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/privacy" className="underline-offset-4 hover:text-ink hover:underline">
              Privacy
            </Link>
            <p>The image never leaves the device. Nothing here has ever seen it.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
