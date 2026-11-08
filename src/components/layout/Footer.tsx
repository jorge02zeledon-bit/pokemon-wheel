import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-12 border-t border-border bg-bg/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-muted sm:px-6 md:grid-cols-3">
        <div className="space-y-3">
          <p className="text-base font-bold text-text">HonshuWheel</p>
          <p>
            HonshuWheel is not affiliated with, endorsed by, or sponsored by The Pokémon Company,
            Nintendo, Creatures, or Game Freak. Product names are used only to identify sealed
            merchandise.
          </p>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-text">Legal</p>
          <ul className="space-y-1">
            <li><Link href="/legal/terms" className="hover:text-text">Terms of Service</Link></li>
            <li><Link href="/legal/privacy" className="hover:text-text">Privacy Policy</Link></li>
            <li><Link href="/legal/rules" className="hover:text-text">Official Rules</Link></li>
            <li><Link href="/legal/shipping" className="hover:text-text">Shipping & Buyback Policy</Link></li>
            <li><Link href="/odds" className="hover:text-text">Odds & Rules</Link></li>
          </ul>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-text">18+ only. Play responsibly.</p>
          <p>
            If you or someone you know has a gambling problem, call or text{" "}
            <a href="tel:1-800-426-2537" className="font-semibold text-text underline">1-800-GAMBLER</a>{" "}
            or visit the{" "}
            <a
              href="https://www.ncpgambling.org/help-treatment/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-text underline"
            >
              National Council on Problem Gambling
            </a>
            .
          </p>
          <p>
            <Link href="/account#responsible-play" className="hover:text-text">
              Set deposit limits, take a break, or self-exclude
            </Link>
          </p>
        </div>
      </div>
      <div className="border-t border-border px-4 py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} HonshuWheel. Legal pages are drafts pending attorney review.
      </div>
    </footer>
  );
}
