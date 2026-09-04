import Link from "next/link";
import { notFound } from "next/navigation";
import { getPerformanceDescription } from "@/lib/performance-descriptions";
import PerformanceContentBlocks from "@/components/PerformanceContentBlocks";
import ImageLightbox from "@/components/ImageLightbox";
import { MenuBar } from "@/components/desktop/Chrome";

export const dynamic = "force-dynamic";

export default function PerformanceAboutPage({
  params,
}: {
  params: { slug: string };
}) {
  const desc = getPerformanceDescription(params.slug);

  if (!desc) {
    notFound();
  }

  return (
    <>
      <MenuBar
        menu={[
          { href: "/singulars/", label: "singulars" },
          { href: `/singulars/${params.slug}`, label: "poems and voting" },
        ]}
      />
      <main className="desk">
        <section className="win w--five">
          <div className="win__bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <h2 className="win__t">{params.slug}.txt</h2>
          </div>
          <div className="win__b">
            <p className="k">{desc.series}</p>
            <h1 className="disp">{desc.title}</h1>
            <p className="sub">{desc.location}</p>
            <p className="sg-meta">
              <span>{desc.date}</span>
            </p>
            <div className="rule" />
            <div className="sg-row">
              <a
                className="btn"
                href={desc.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                live site &#x2197;
              </a>
              <a
                className="btn"
                href={desc.datasetUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                dataset &#x2197;
              </a>
            </div>
            <div className="rule" />
            <div className="sg-row">
              <Link className="btn" href={`/${params.slug}`}>
                poems and voting &rarr;
              </Link>
              <Link className="btn" href="/">
                all performances &rarr;
              </Link>
            </div>
          </div>
        </section>

        <section className="win w--seven">
          <div className="win__bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <h2 className="win__t">about.txt</h2>
          </div>
          <div className="win__b">
            <PerformanceContentBlocks content={desc.content} />
          </div>
        </section>

        {/* This page renders the same content blocks as the performance page,
            so it needs the carousel too - otherwise those images advertise
            themselves as clickable and do nothing. */}
        <ImageLightbox />
      </main>
    </>
  );
}
