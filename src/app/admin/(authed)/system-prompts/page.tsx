/**
 * /admin/system-prompts
 *
 * Read-only display of the active system prompt as a first-class artistic
 * artifact. The prompt itself lives in src/lib/system-prompts.ts; this page
 * renders it nicely:
 *   - Header with name + version + date
 *   - Stats row (total poets, max lines, formats, tone directives)
 *   - Full text in a body-typography card
 *   - The named poets as chips linking to their Wikipedia entries
 *   - Copy-raw-text affordance
 *   - Past prompts collapsed at bottom for historical record
 *
 * Mobile: chips wrap, full text reflows.
 */

import { ALL_SYSTEM_PROMPTS, ACTIVE_SYSTEM_PROMPT } from "@/lib/system-prompts";
import { CopyButton } from "./CopyButton";

import Win from "@/components/desktop/Win";

export const dynamic = "force-dynamic";

export default function SystemPromptsPage() {
  const active = ACTIVE_SYSTEM_PROMPT;
  const archived = ALL_SYSTEM_PROMPTS.filter(
    (p) => p.slug !== active.slug || p.version !== active.version,
  );

  return (
    <>
      <Win file="system-prompts.txt" span="w--eight">
        <p className="k">fine-tune pipeline</p>
        <h1 className="h2">system prompts</h1>
        <p className="note">
          The active prompt conditions every fine-tune and every candidate
          generation. It is the artistic register every model inherits.
        </p>
      </Win>

      <PromptCard prompt={active} active />

      {archived.length > 0 ? (
        <>
          <Win file="archive.txt" span="w--five">
            <p className="note" style={{ marginTop: 0 }}>
              Previous prompts, kept for the record. An eval run created under
              an older prompt stays valid: it references whatever was active at
              its time.
            </p>
          </Win>
          {archived.map((p) => (
            <PromptCard key={`${p.slug}-${p.version}`} prompt={p} />
          ))}
        </>
      ) : null}
    </>
  );
}

function PromptCard({
  prompt,
  active,
}: {
  prompt: typeof ACTIVE_SYSTEM_PROMPT;
  active?: boolean;
}) {
  return (
    <section
      className="win w--eight"
      style={active ? undefined : { opacity: 0.75 }}
    >
      <div className="win__bar">
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
        <h2 className="win__t">
          {prompt.slug}.{prompt.version}.txt
        </h2>
        <span className="win__meta">
          {active ? "active" : "archived"}
        </span>
      </div>
      <div className="win__b">
        <div className="sg-row sg-row--between">
          <div>
            <p className="k">
              {prompt.version} &middot; active since {prompt.active_at}
            </p>
            <h3 className="h2">{prompt.name}</h3>
          </div>
          <CopyButton text={prompt.text} />
        </div>

        {prompt.description ? (
          <p className="note" style={{ fontStyle: "italic" }}>
            {prompt.description}
          </p>
        ) : null}

        <div className="rule" />

        <div className="sg-tiles">
          <Stat
            label="poets"
            value={String(prompt.poets.length)}
            hint={prompt.poets.length === 0 ? "(none)" : undefined}
          />
          <Stat label="max lines" value={String(prompt.max_lines)} />
          <Stat
            label="formats"
            value={
              prompt.formats.length === 1
                ? prompt.formats[0]
                : `${prompt.formats.length}`
            }
            hint={
              prompt.formats.length > 1 ? prompt.formats.join(" + ") : undefined
            }
          />
          <Stat
            label="tone"
            value={
              prompt.tone_directives.length === 0
                ? "-"
                : String(prompt.tone_directives.length)
            }
            hint={
              prompt.tone_directives.length > 0
                ? prompt.tone_directives.join(", ")
                : undefined
            }
          />
          <Stat
            label="citations"
            value={prompt.no_literal_citations ? "blocked" : "allowed"}
          />
        </div>

        <div className="rule" />

        {/* The prompt text itself is training data: shown verbatim. */}
        <pre className="sg-pre">{prompt.text}</pre>

        {prompt.poets.length > 0 ? (
          <>
            <div className="rule" />
            <p className="k">poets ({prompt.poets.length})</p>
            <div className="sg-row sg-row--tight" style={{ marginTop: "0.5rem" }}>
              {prompt.poets.map((poet) => (
                <a
                  key={poet}
                  className="btn"
                  href={`https://en.wikipedia.org/wiki/${encodeURIComponent(poet.replace(/ /g, "_"))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {poet}
                </a>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="sg-tile">
      <div className="sg-tile__v" style={{ fontSize: "1rem" }}>
        {value}
      </div>
      <span className="k sg-tile__k">{label}</span>
      {hint ? <span className="sg-tile__n">{hint}</span> : null}
    </div>
  );
}
