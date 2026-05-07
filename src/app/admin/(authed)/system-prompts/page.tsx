/**
 * /admin/system-prompts
 *
 * Read-only display of the active system prompt as a first-class artistic
 * artifact. The prompt itself lives in src/lib/system-prompts.ts; this page
 * renders it nicely:
 *   - Header with name + version + date
 *   - Stats row (total poets, max lines, formats, tone directives)
 *   - Full text in a body-typography card
 *   - The named poets as performance-color chips (ground.exe accent for the
 *     current era's prompt)
 *   - Copy-raw-text affordance
 *   - Past prompts collapsed at bottom for historical record
 *
 * Mobile: chips wrap, full text reflows.
 */

import { ALL_SYSTEM_PROMPTS, ACTIVE_SYSTEM_PROMPT } from "@/lib/system-prompts";
import { CopyButton } from "./CopyButton";

const GROUND_EXE_COLOR = "#D97706";
const MONO = '"Diatype Mono Variable", monospace';
const STANDARD = '"Standard", sans-serif';
const DISPLAY = '"Terminal Grotesque", sans-serif';

export const dynamic = "force-dynamic";

export default function SystemPromptsPage() {
  const active = ACTIVE_SYSTEM_PROMPT;
  const archived = ALL_SYSTEM_PROMPTS.filter(
    (p) => p.slug !== active.slug || p.version !== active.version,
  );

  return (
    <div>
      <h1
        style={{
          fontFamily: DISPLAY,
          fontSize: "3.5rem",
          lineHeight: 0.9,
          margin: "0 0 0.5rem 0",
        }}
      >
        system prompts
      </h1>
      <p
        style={{
          fontFamily: MONO,
          fontSize: "0.9rem",
          color: "var(--text-secondary)",
          margin: "0 0 2.5rem 0",
        }}
      >
        the active prompt conditions every fine-tune + every candidate
        generation. it is the artistic register all models inherit.
      </p>

      {/* Active prompt card */}
      <PromptCard prompt={active} active />

      {archived.length > 0 ? (
        <>
          <h2
            style={{
              fontFamily: '"Diatype Variable", sans-serif',
              fontSize: "1.25rem",
              fontWeight: 700,
              margin: "3rem 0 1rem 0",
            }}
          >
            archive
          </h2>
          <p
            style={{
              fontFamily: MONO,
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
              margin: "0 0 1.5rem 0",
            }}
          >
            previous prompts kept for historical record. eval runs created under
            an older prompt remain valid; they reference whatever was active at
            their time.
          </p>
          {archived.map((p) => (
            <PromptCard key={`${p.slug}-${p.version}`} prompt={p} />
          ))}
        </>
      ) : null}
    </div>
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
    <article
      style={{
        border: active
          ? `1px solid ${GROUND_EXE_COLOR}`
          : "1px solid var(--border-light)",
        marginBottom: "1.5rem",
        opacity: active ? 1 : 0.7,
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: "1.25rem 1.5rem",
          borderBottom: "1px solid var(--border-light)",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: '"Diatype Variable", sans-serif',
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            {prompt.name}
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: "0.8rem",
              color: "var(--text-tertiary)",
              marginTop: "0.25rem",
            }}
          >
            {prompt.version} · active since {prompt.active_at}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {active ? (
            <span
              style={{
                fontFamily: MONO,
                fontSize: "0.7rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                padding: "0.25rem 0.7rem",
                background: GROUND_EXE_COLOR,
                color: "#fff",
                borderRadius: "2px",
              }}
            >
              active
            </span>
          ) : null}
          <CopyButton text={prompt.text} accentColor={GROUND_EXE_COLOR} />
        </div>
      </header>

      {/* Description */}
      {prompt.description ? (
        <div
          style={{
            padding: "1rem 1.5rem",
            borderBottom: "1px solid var(--border-light)",
            fontFamily: STANDARD,
            fontSize: "0.95rem",
            lineHeight: 1.5,
            color: "var(--text-secondary)",
            fontStyle: "italic",
          }}
        >
          {prompt.description}
        </div>
      ) : null}

      {/* Metadata grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "1px",
          background: "var(--border-light)",
          borderBottom: "1px solid var(--border-light)",
        }}
      >
        <Stat
          label="poets"
          value={String(prompt.poets.length)}
          hint={prompt.poets.length === 0 ? "(none)" : undefined}
        />
        <Stat label="max lines" value={String(prompt.max_lines)} />
        <Stat
          label="formats"
          value={prompt.formats.length === 1 ? prompt.formats[0] : `${prompt.formats.length}`}
          hint={prompt.formats.length > 1 ? prompt.formats.join(" + ") : undefined}
        />
        <Stat
          label="tone"
          value={prompt.tone_directives.length === 0 ? "-" : String(prompt.tone_directives.length)}
          hint={prompt.tone_directives.length > 0 ? prompt.tone_directives.join(", ") : undefined}
        />
        <Stat
          label="citations"
          value={prompt.no_literal_citations ? "blocked" : "allowed"}
        />
      </div>

      {/* Body text */}
      <div
        style={{
          padding: "1.5rem",
          fontFamily: STANDARD,
          fontSize: "1.05rem",
          lineHeight: 1.7,
          color: "var(--text-primary)",
          whiteSpace: "pre-wrap",
        }}
      >
        {prompt.text}
      </div>

      {/* Poet chips */}
      {prompt.poets.length > 0 ? (
        <div
          style={{
            padding: "1.5rem",
            borderTop: "1px solid var(--border-light)",
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: "0.7rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-tertiary)",
              marginBottom: "0.75rem",
            }}
          >
            poets ({prompt.poets.length})
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.4rem",
            }}
          >
            {prompt.poets.map((poet) => (
              <a
                key={poet}
                href={`https://en.wikipedia.org/wiki/${encodeURIComponent(poet.replace(/ /g, "_"))}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: MONO,
                  fontSize: "0.78rem",
                  padding: "0.3rem 0.6rem",
                  border: `1px solid ${GROUND_EXE_COLOR}`,
                  color: GROUND_EXE_COLOR,
                  textDecoration: "none",
                  borderRadius: "2px",
                  whiteSpace: "nowrap",
                  transition: "background 0.2s ease, color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = GROUND_EXE_COLOR;
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = GROUND_EXE_COLOR;
                }}
              >
                {poet}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </article>
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
    <div
      style={{
        background: "#fff",
        padding: "1rem 1.25rem",
      }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--text-tertiary)",
          marginBottom: "0.4rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: "1.05rem",
          fontWeight: 500,
          color: "var(--text-primary)",
        }}
      >
        {value}
      </div>
      {hint ? (
        <div
          style={{
            fontFamily: MONO,
            fontSize: "0.75rem",
            color: "var(--text-tertiary)",
            marginTop: "0.25rem",
            wordBreak: "break-word",
          }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}
