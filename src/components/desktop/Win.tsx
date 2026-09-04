/**
 * A window on the desk.
 *
 * The canon's markup, as one component, because the admin surface stamps out
 * dozens of them: three dots, a mono filename title, optional meta on the
 * right, then the body. `span` takes one of the w--* grid classes from
 * pages.css; `id` gives the menu bar something to anchor to.
 *
 * Anything richer than a title and a meta string (a toggle in the bar, say)
 * writes the markup out by hand instead.
 */
export default function Win({
  file,
  meta,
  span = "",
  id,
  children,
  bodyless = false,
}: {
  file: string;
  meta?: React.ReactNode;
  span?: string;
  id?: string;
  children: React.ReactNode;
  /** Skip the .win__b padding wrapper; the caller supplies its own. */
  bodyless?: boolean;
}) {
  return (
    <section className={span ? `win ${span}` : "win"} id={id}>
      <div className="win__bar">
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
        <h2 className="win__t">{file}</h2>
        {meta ? <span className="win__meta">{meta}</span> : null}
      </div>
      {bodyless ? children : <div className="win__b">{children}</div>}
    </section>
  );
}
