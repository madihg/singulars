import type { PerformanceDescription } from "@/lib/performance-descriptions";

interface PerformanceContentBlocksProps {
  content: PerformanceDescription["content"];
}

/**
 * The long-form description of a performance, rendered in the Desktop
 * register: .prose paragraphs, .h2 headings, a hairline-ruled quote, and
 * stills that keep the canon's bordered .shot treatment. Every image stays a
 * lightbox target (data-lightbox), which ImageLightbox discovers.
 */
export default function PerformanceContentBlocks({
  content,
}: PerformanceContentBlocksProps) {
  return (
    <>
      {content.map((block, i) => {
        switch (block.type) {
          case "paragraph":
            return (
              <p key={i} className="prose">
                {block.text}
              </p>
            );

          case "heading":
            return (
              <h3
                key={i}
                className="h2"
                style={{ margin: "1.6rem 0 0.7rem" }}
              >
                {block.text}
              </h3>
            );

          case "italic":
            return (
              <blockquote
                key={i}
                className="prose"
                style={{
                  fontStyle: "italic",
                  color: "var(--ink-60)",
                  borderLeft: "1px solid var(--metal)",
                  paddingLeft: "1rem",
                  margin: "1.2rem 0",
                }}
              >
                {block.text}
              </blockquote>
            );

          case "image":
            return (
              <figure key={i} className="shot" style={{ margin: "1.2rem 0" }}>
                <img
                  src={block.src}
                  alt={block.alt}
                  loading="lazy"
                  decoding="async"
                  width={1600}
                  height={1067}
                  data-lightbox=""
                  role="button"
                  tabIndex={0}
                  style={{ cursor: "zoom-in", height: "auto" }}
                />
              </figure>
            );

          case "gallery": {
            const isDense = block.items.length > 5;
            return (
              <div
                key={i}
                className="sg-cards"
                style={{
                  gridTemplateColumns: `repeat(auto-fill, minmax(${isDense ? "8rem" : "12rem"}, 1fr))`,
                  gap: isDense ? "0.5rem" : "0.9rem",
                  margin: "1.2rem 0",
                }}
              >
                {block.items.map((item, j) => (
                  <img
                    key={j}
                    src={item.src}
                    alt={item.alt}
                    loading="lazy"
                    decoding="async"
                    width={800}
                    height={800}
                    data-lightbox=""
                    role="button"
                    tabIndex={0}
                    style={{
                      width: "100%",
                      height: "auto",
                      display: "block",
                      aspectRatio: isDense ? "1" : "auto",
                      objectFit: isDense ? "cover" : "contain",
                      border: "1px solid var(--metal)",
                      borderRadius: 4,
                      cursor: "zoom-in",
                    }}
                  />
                ))}
              </div>
            );
          }

          default:
            return null;
        }
      })}
    </>
  );
}
