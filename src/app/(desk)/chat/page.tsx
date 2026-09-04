"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useChat } from "ai/react";
import TextareaAutosize from "react-textarea-autosize";
import {
  MODELS,
  getSortedModels,
  getDefaultModel,
  performanceSlugForModel,
  isValidModelSlug,
  type Model,
  type ModelSlug,
} from "@/lib/models";
import { MenuBar } from "@/components/desktop/Chrome";

/*
 * machine.txt - the chat desk.
 *
 * Two windows: the models registry on the left, the transcript on the right.
 * The transcript reads as a ledger, one turn per row, labelled "you" and
 * "machine" in the mono register. The model picker is a column of .btn chips
 * with aria-pressed, so it needs no separate mobile control: below 760px the
 * windows stack and the picker sits above the transcript.
 *
 * The reskin did not touch the streaming: useChat, the two API routes, the
 * provider split and the rate-limit handling are exactly as they were.
 */

// Sorted once at module load - trained models first (newest -> oldest),
// then the divider, then training models. Status of each model doesn't
// change at runtime so this is fine.
const SORTED_MODELS = getSortedModels();
const DEFAULT_SLUG = getDefaultModel().slug;

export default function ChatPage() {
  const [activeSlug, setActiveSlug] = useState<ModelSlug>(DEFAULT_SLUG);
  const activeModel = MODELS.find((m) => m.slug === activeSlug)!;
  const isTraining = activeModel.status === "training";

  // Route to the runtime that can actually reach each provider:
  //   - OpenAI fine-tunes   -> /api/chat       (Node, 60s timeout headroom)
  //   - OpenRouter (Claude) -> /api/chat-edge  (edge; the Node lambda cannot
  //     reach openrouter.ai). useChat re-binds `api` when this changes
  //     because triggerRequest lists `api` in its deps.
  const chatApi =
    activeModel.provider === "openrouter"
      ? "/singulars/api/chat-edge"
      : "/singulars/api/chat";

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    setMessages,
    error,
  } = useChat({
    api: chatApi,
    body: { modelSlug: activeSlug },
    onResponse: (response) => {
      if (response.status === 429) {
        setRateLimited(true);
      }
    },
  });

  const [rateLimited, setRateLimited] = useState(false);

  const switchModel = useCallback(
    (slug: ModelSlug) => {
      if (slug === activeSlug) return;
      setActiveSlug(slug);
      setMessages([]);
      setInput("");
      setRateLimited(false);
    },
    [activeSlug, setMessages, setInput],
  );

  // Preselect a model from ?model=<slug> (e.g. a performance page linking
  // "chat with this model"). Runs once on mount to avoid hydration mismatch.
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("model");
    if (m && isValidModelSlug(m)) switchModel(m as ModelSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExampleClick = useCallback(
    (prompt: string) => {
      setInput(prompt);
      // Submit after a tick so the input state updates
      setTimeout(() => {
        const form = document.querySelector(
          "[data-chat-form]",
        ) as HTMLFormElement;
        form?.requestSubmit();
      }, 0);
    },
    [setInput],
  );

  const hasMessages = messages.length > 0;

  return (
    <>
      <MenuBar
        menu={[
          { href: "/singulars/", label: "singulars" },
          { href: "#models", label: "models" },
          { href: "#machine", label: "transcript" },
        ]}
      />
      <main className="desk">
        <ModelWindow
          models={SORTED_MODELS}
          activeSlug={activeSlug}
          onSelect={switchModel}
        />

        <section className="win w--eight" id="machine">
          <div className="win__bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <h2 className="win__t">machine.txt</h2>
            <span className="win__meta">{activeModel.displayName}</span>
          </div>
          <div className="win__b">
            {!hasMessages ? (
              <WelcomeScreen
                model={activeModel}
                onExampleClick={handleExampleClick}
              />
            ) : (
              <MessageList messages={messages} isLoading={isLoading} />
            )}

            {rateLimited && (
              <p className="sg-err" role="alert">
                Rate limit reached. Wait a moment before sending another
                message.
              </p>
            )}
            {error && !rateLimited && (
              <p className="sg-err" role="alert">
                {/* Surface the real error from /api/chat when we have it (ai@2
                    puts the response body text on error.message). Falls back to
                    the generic line if it is an opaque network failure. */}
                {parseChatError(error.message)}
              </p>
            )}

            {isTraining ? (
              <p className="note">
                This model is training during a live performance. Chat opens
                once the show closes and the audience-decided pairs land.
              </p>
            ) : null}

            <form
              data-chat-form
              className="sg-ask"
              onSubmit={(e) => {
                if (isTraining) {
                  e.preventDefault();
                  return;
                }
                handleSubmit(e);
              }}
            >
              <label className="dk-input">
                <span>ask</span>
                <TextareaAutosize
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isTraining}
                  onKeyDown={(e) => {
                    if (isTraining) return;
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      const form = e.currentTarget.closest("form");
                      form?.requestSubmit();
                    }
                  }}
                  placeholder={
                    isTraining
                      ? "training - chat locked until the show closes"
                      : activeModel.language === "fr"
                        ? "Demandez un poème"
                        : "Ask for a poem"
                  }
                  maxRows={6}
                />
              </label>
              <button
                type="submit"
                className="btn btn--send"
                disabled={isTraining || !input.trim() || isLoading}
              >
                {isLoading ? "sending" : isTraining ? "locked" : "send"}
              </button>
            </form>
          </div>
        </section>
      </main>
    </>
  );
}

/**
 * Pull a human-readable message out of useChat's error. Our /api/chat
 * returns `{ "error": "..." }` on failure; ai@2 surfaces that body as
 * error.message. If it parses, show the server's message; otherwise show a
 * generic line.
 */
function parseChatError(raw: string | undefined): string {
  if (!raw) return "Something went wrong. Try again.";
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.error === "string") return parsed.error;
  } catch {
    // not JSON - fall through
  }
  // Avoid dumping a giant HTML error page at the user.
  if (raw.length > 0 && raw.length < 200 && !raw.includes("<")) return raw;
  return "Something went wrong. Try again.";
}

/* ---- Sub-components ---- */

function ModelWindow({
  models,
  activeSlug,
  onSelect,
}: {
  models: Model[];
  activeSlug: ModelSlug;
  onSelect: (slug: ModelSlug) => void;
}) {
  return (
    <nav className="win w--four" id="models" aria-label="models">
      <div className="win__bar">
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
        <h2 className="win__t">models/</h2>
        <span className="win__meta">{models.length}</span>
      </div>
      <div className="win__b">
        <div className="sg-models">
          {models.map((model, idx) => {
            const isActive = model.slug === activeSlug;
            const isTraining = model.status === "training";
            // A divider + "training" label before the first training model.
            const prev = models[idx - 1];
            const showTrainingDivider =
              isTraining && (!prev || prev.status !== "training");
            return (
              <React.Fragment key={model.slug}>
                {showTrainingDivider ? (
                  <>
                    <div className="rule" />
                    <span className="k">training</span>
                  </>
                ) : null}
                <button
                  type="button"
                  className="btn"
                  aria-pressed={isActive}
                  onClick={() => onSelect(model.slug)}
                >
                  <i
                    className="cdot"
                    style={{
                      ["--c" as string]: model.color,
                      marginRight: "0.45rem",
                    }}
                  />
                  {model.displayName}
                  {isTraining ? " · training" : ""}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function WelcomeScreen({
  model,
  onExampleClick,
}: {
  model: Model;
  onExampleClick: (prompt: string) => void;
}) {
  return (
    <div className="sg-stack">
      <div>
        <p className="k">
          <i className="cdot" style={{ ["--c" as string]: model.color }} /> model
        </p>
        <h1 className="h2">{model.displayName}</h1>
      </div>

      <p className="prose" style={{ margin: 0 }}>
        {model.language === "fr"
          ? "Je suis le rival d'Halim Madi. Une intelligence artificielle, un modèle entraîné sur le meilleur de la poésie française contemporaine."
          : "I am the rival of Halim Madi. An artificial intelligence, a model trained on the best of contemporary poetry."}
      </p>

      <div className="sg-stack sg-stack--tight">
        <span className="k">try</span>
        {model.examplePrompts.map((prompt, i) => (
          <button
            key={i}
            type="button"
            className="btn"
            style={{ textAlign: "left" }}
            onClick={() => onExampleClick(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="sg-row">
        {/* A plain <a>, so it carries the basePath prefix itself. */}
        <a
          className="btn"
          href={`/singulars/${performanceSlugForModel(model)}`}
        >
          about the performance &rarr;
        </a>
        {/* Omitted for models without a public dataset (e.g. frontière,
            which is not fine-tuned). */}
        {model.huggingFaceUrl ? (
          <a
            className="btn"
            href={model.huggingFaceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            dataset on huggingface &#x2197;
          </a>
        ) : null}
      </div>
    </div>
  );
}

function MessageList({
  messages,
  isLoading,
}: {
  messages: { role: string; content: string; id: string }[];
  isLoading: boolean;
}) {
  // Show the "generating" indicator while a request is in flight and the
  // model hasn't started streaming text yet (no assistant message, or an
  // empty one). Fine-tuned models can take a few seconds to first token -
  // without this the screen looks frozen, which reads as broken.
  const last = messages[messages.length - 1];
  const showGenerating =
    isLoading &&
    (!last || last.role !== "assistant" || last.content.length === 0);

  return (
    <div className="sg-chat">
      {messages.map((message) => (
        <div
          key={message.id}
          className="sg-turn"
          data-who={message.role === "assistant" ? "machine" : "you"}
        >
          <span className="k">
            {message.role === "assistant" ? "machine" : "you"}
          </span>
          <p className="sg-turn__b">{message.content}</p>
        </div>
      ))}

      {showGenerating && (
        <div
          className="sg-turn"
          data-who="machine"
          aria-live="polite"
          aria-label="generating a poem"
        >
          <span className="k">machine</span>
          <p className="sg-turn__b">writing</p>
        </div>
      )}
    </div>
  );
}
