import type { ReactNode } from "react";
import { page } from "../common";

export type Page = "home" | "models" | "docs" | "bench" | "parity" | "model" | "train";

/** The submenu under the title, the same on every nodd page. The model page belongs to Models. */
const MENU: [Page, string, string][] = [
  ["home", "Overview", page("")],
  ["train", "Train", page("train")],
  ["models", "Models", page("models")],
  ["docs", "Docs", page("docs")],
];

/** The Quaedra Research mark, as on quaedra.com. */
const GLYPH = (
  <svg className="glyph" viewBox="136 112 242 208" aria-hidden="true">
    <path fill="currentColor" transform="translate(91.1667 386.1667) scale(0.64 -0.64)" d="M74 422H134Q143 264 252 264Q362 264 381 422H441Q428 290 336 231Q376 163 436 183L444 153Q356 111 278 206Q265 204 252 204Q106 204 74 422Z" />
  </svg>
);

/** quaedra.com's page chrome: the site mark, the title and nodd's submenu, then the page and the site footer. */
export function Layout({ page: current, wide, lede, intro, children }: {
  page: Page;
  wide?: boolean;
  lede?: ReactNode;
  /** Shown in the header under the submenu, like the key figures on the overview. */
  intro?: ReactNode;
  children: ReactNode;
}) {
  const section = current === "model" ? "models" : current;
  return (
    <div className={wide ? "app wide" : "app"}>
      <header>
        <a className="crumb" href="/">{GLYPH}Quaedra Research</a>
        <h1>nodd</h1>
        {lede && <p className="lede">{lede}</p>}
        <nav className="links" aria-label="nodd">
          {MENU.map(([p, label, href]) => (
            <a key={p} href={href} aria-current={p === section ? "page" : undefined}>{label}</a>
          ))}
          <a href="https://github.com/quaedra/nodd">GitHub</a>
        </nav>
        {intro}
      </header>
      <main>{children}</main>
      <footer>
        <span>© {new Date().getFullYear()} Quaedra Research</span>
        <nav aria-label="Site">
          <a href="/contact">Contact</a>
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="https://github.com/quaedra">GitHub</a>
        </nav>
      </footer>
    </div>
  );
}
