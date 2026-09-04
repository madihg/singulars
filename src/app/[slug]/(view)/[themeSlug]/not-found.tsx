import Link from "next/link";
import { MenuBar } from "@/components/desktop/Chrome";

export default function ThemeNotFound() {
  return (
    <>
      <MenuBar menu={[{ href: "/singulars/", label: "singulars" }]} />
      <main className="desk">
        <section className="win w--seven">
          <div className="win__bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <h2 className="win__t">404.txt</h2>
          </div>
          <div className="win__b">
            <p className="k">theme not found</p>
            <h1 className="disp">404</h1>
            <p className="prose" style={{ marginTop: "1rem" }}>
              This theme does not exist under this performance.
            </p>
            <Link className="btn" href="/">
              all performances &rarr;
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
