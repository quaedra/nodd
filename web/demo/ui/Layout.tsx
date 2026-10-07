import type { ReactNode } from "react";

export type Page = "home" | "repository" | "docs" | "bench" | "parity" | "model" | "train";

const NAV: [Page, string, string][] = [
  ["train", "Train", "./train.html"],
  ["repository", "Community", "./repository.html"],
  ["docs", "Docs", "./docs.html"],
];

/** Nodding ball; the animation lives inside the SVG (and respects prefers-reduced-motion). */
const LOGO = <img className="logo" src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={22} height={22} />;

/** Checks that live in the footer; `model` carries ?model= over to them. */
const FOOTER: [Page, string, string][] = [
  ["bench", "Benchmark", "./bench.html"],
  ["parity", "Parity", "./parity.html"],
];

function Links({ items, page, query = "" }: { items: [Page, string, string][]; page: Page; query?: string }) {
  return items.map(([p, label, href], i) => (
    <span key={p}>
      {i > 0 && " · "}
      {p === page ? <b aria-current="page">{label}</b> : <a href={href + query}>{label}</a>}
    </span>
  ));
}

/** The Quaedra Research mark, as on quaedra.com. */
const GLYPH = (
  <svg className="glyph" viewBox="136 112 242 208" aria-hidden="true">
    <path fill="currentColor" transform="translate(91.1667 386.1667) scale(0.64 -0.64)" d="M74 422H134Q143 264 252 264Q362 264 381 422H441Q428 290 336 231Q376 163 436 183L444 153Q356 111 278 206Q265 204 252 204Q106 204 74 422Z" />
  </svg>
);

/** Site chrome, matching quaedra.com: breadcrumb, the app's pages, and the site footer. */
export function Layout({ page, wide, model, children }: { page: Page; wide?: boolean; model?: string; children: ReactNode }) {
  const query = model ? `?model=${encodeURIComponent(model)}` : "";
  return (
    <div className={wide ? "app wide" : "app"}>
      <p className="crumb">
        <a href="/">{GLYPH}Quaedra Research</a> / <a href="/nodd">nodd</a> / App
      </p>
      <nav aria-label="Main">
        {page === "home" ? (
          <b className="brand" aria-current="page">
            {LOGO}Playground
          </b>
        ) : (
          <a className="brand" href="./">
            {LOGO}Playground
          </a>
        )}
        {NAV.map(([p, label, href]) => (p === page ? <b key={p} aria-current="page">{label}</b> : <a key={p} href={href}>{label}</a>))}
        <a href="https://github.com/quaedra/nodd">GitHub</a>
      </nav>
      {children}
      <footer>
        <p>
          © {new Date().getFullYear()} Quaedra Research · <Links items={FOOTER} page={page} query={query} />
        </p>
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
