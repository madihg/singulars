/**
 * The Desktop chrome, ported verbatim from the halimmadi.com canon
 * (halim-madi: DESIGN-DESKTOP.md, index.html, connect/index.html).
 *
 * Singulars is a surface of halimmadi.com, not a separate site, so the menu
 * bar, the site map behind the wordmark, the one-line footer and the
 * human/machine mascot are the same furniture with the same markup. Behaviour
 * comes from /singulars/desktop/desktop.js (the canon's Assets/js/desktop.js).
 *
 * Cross-site links are absolute www.halimmadi.com URLs: those pages are served
 * by the halim-madi repo, not by this Next app, so next/link and the basePath
 * must stay out of them.
 */

const SITE = "https://www.halimmadi.com";

export const CONNECT_URL = `${SITE}/connect/#start`;

export interface MenuLink {
  href: string;
  label: string;
  /** Marks the current page in the bar. */
  current?: boolean;
}

/**
 * The sticky menu bar. `menu` holds the page-local anchors; every page passes
 * its own, the way each canon page does.
 */
export function MenuBar({ menu = [] }: { menu?: MenuLink[] }) {
  return (
    <nav className="mb">
      <div className="mb__in">
        <div className="mb__appwrap">
          <a className="mb__app" href={`${SITE}/`}>
            halim madi
          </a>
          <button
            className="mb__more"
            type="button"
            data-menu-toggle
            aria-expanded="false"
            aria-controls="sitemenu"
            aria-label="site menu"
          >
            &#9662;
          </button>
          <div className="mb__drop win" id="sitemenu" data-menu-drop hidden>
            <a href="/singulars/">
              <i className="cdot" style={{ ["--c" as string]: "var(--mark-vermilion)" }} />
              machine poetry &middot; singulars
            </a>
            <a href={`${SITE}/computer-theater/`}>
              <i className="cdot" style={{ ["--c" as string]: "var(--mark-azure)" }} />
              computer theater
            </a>
            <a href={`${SITE}/wikitongues/`}>
              <i className="cdot" style={{ ["--c" as string]: "var(--mark-viridian)" }} />
              language revitalization &middot; wikitongues
            </a>
            <div className="rule" />
            <a href={`${SITE}/works/`}>works</a>
            <a href={`${SITE}/writing/`}>writing</a>
            <a href={`${SITE}/engagements/`}>engagements</a>
            <div className="rule" />
            <a href={`${SITE}/about/`}>about</a>
            <a href={`${SITE}/connect/`}>connect</a>
            <div className="rule" />
            <a
              href="https://halimmadi.substack.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              newsletter &#x2197;
            </a>
            <a
              href="https://www.instagram.com/yalla_halim"
              target="_blank"
              rel="noopener noreferrer"
            >
              instagram &#x2197;
            </a>
          </div>
        </div>
        <div className="mb__menu">
          {menu.map((m) => (
            <a
              key={m.href + m.label}
              href={m.href}
              aria-current={m.current ? "page" : undefined}
            >
              {m.label}
            </a>
          ))}
        </div>
        <a className="cta" href={CONNECT_URL}>
          <i />
          <span className="cta__t">start a conversation</span>
        </a>
      </div>
    </nav>
  );
}

/** The one-line footer, identical on every surface. */
export function Footer() {
  return (
    <footer className="fb">
      <div className="fb__in">
        <span>halim madi</span>
        <a href={`${SITE}/computer-theater/`}>computer theater</a>
        <a href="/singulars/">singulars</a>
        <a href={`${SITE}/wikitongues/`}>wikitongues</a>
        <span className="fb__spacer" />
        <a className="fb__cta" href={CONNECT_URL}>
          start a conversation
        </a>
        <a
          href="https://halimmadi.substack.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          newsletter &#x2197;
        </a>
        <a
          href="https://www.instagram.com/yalla_halim"
          target="_blank"
          rel="noopener noreferrer"
        >
          instagram &#x2197;
        </a>
      </div>
    </footer>
  );
}

/** The human / machine pill. Lines and toggling live in desktop.js. */
export function Mascot() {
  return (
    <div className="mascot" data-mascot-root>
      <button type="button" data-mascot-human aria-pressed="true">
        <i />
        human
      </button>
      <button type="button" data-mascot-machine aria-pressed="false">
        <i />
        machine
      </button>
      <span className="mascot__line" aria-live="polite" />
    </div>
  );
}

/**
 * The page shell used by every layout that carries chrome: content, then the
 * footer and the mascot. The menu bar is NOT here - each page renders its own
 * <MenuBar> with its own anchors, the way each canon page does. The venue
 * screens (/[slug]/stage, /[slug]/control, /timer) use no shell at all.
 */
export default function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Footer />
      <Mascot />
    </>
  );
}
