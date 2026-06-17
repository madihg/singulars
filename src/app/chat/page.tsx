"use client";

import React, { useState, useCallback } from "react";
import { useChat } from "ai/react";
import TextareaAutosize from "react-textarea-autosize";
import {
  MODELS,
  getSortedModels,
  getDefaultModel,
  type Model,
  type ModelSlug,
} from "@/lib/models";
import { readableForegroundOn } from "@/lib/color-utils";

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
  //   - OpenAI fine-tunes  → /api/chat       (Node, 60s timeout headroom)
  //   - OpenRouter (Claude) → /api/chat-edge  (edge; the Node lambda can't
  //     reach openrouter.ai). useChat re-binds `api` when this changes
  //     because triggerRequest lists `api` in its deps.
  const chatApi =
    activeModel.provider === "openrouter" ? "/api/chat-edge" : "/api/chat";

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
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar - model selector */}
      <ModelSidebar
        models={SORTED_MODELS}
        activeSlug={activeSlug}
        onSelect={switchModel}
      />

      {/* Main chat area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          maxWidth: 800,
          margin: "0 auto",
          padding: "2rem 1.5rem",
          width: "100%",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "2rem",
          }}
        >
          <a
            href="/"
            style={{
              fontFamily: '"Diatype Mono Variable", monospace',
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
            }}
          >
            &larr; Singulars
          </a>

          {/* Mobile model selector */}
          <MobileModelSelector
            models={SORTED_MODELS}
            activeSlug={activeSlug}
            onSelect={switchModel}
          />
        </div>

        {/* Chat content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {!hasMessages ? (
            <WelcomeScreen
              model={activeModel}
              onExampleClick={handleExampleClick}
            />
          ) : (
            <MessageList
              messages={messages}
              model={activeModel}
              isLoading={isLoading}
            />
          )}
        </div>

        {/* Error / rate limit */}
        {rateLimited && (
          <p
            style={{
              textAlign: "center",
              color: "#dc2626",
              fontFamily: '"Diatype Mono Variable", monospace',
              fontSize: "0.85rem",
              marginBottom: "1rem",
            }}
          >
            Rate limit reached. Please wait before sending another message.
          </p>
        )}
        {error && !rateLimited && (
          <p
            style={{
              textAlign: "center",
              color: "#dc2626",
              fontFamily: '"Diatype Mono Variable", monospace',
              fontSize: "0.85rem",
              marginBottom: "1rem",
            }}
          >
            {/* Surface the real error from /api/chat when we have it (ai@2
                puts the response body text on error.message). Falls back to
                the generic line if it's an opaque network failure. */}
            {parseChatError(error.message)}
          </p>
        )}

        {/* Training note - visible when the active model is locked. */}
        {isTraining ? (
          <p
            style={{
              fontFamily: '"Diatype Mono Variable", monospace',
              fontSize: "0.75rem",
              color: "var(--text-tertiary)",
              textAlign: "center",
              marginBottom: "0.75rem",
              lineHeight: 1.5,
            }}
          >
            this model is training during a live performance — chat opens
            once the show closes and the audience-decided pairs land.
          </p>
        ) : null}

        {/* Input */}
        <form
          data-chat-form
          onSubmit={(e) => {
            if (isTraining) {
              e.preventDefault();
              return;
            }
            handleSubmit(e);
          }}
          style={{
            display: "flex",
            gap: "0.75rem",
            alignItems: "flex-end",
            borderTop: "1px solid var(--border-light)",
            paddingTop: "1.5rem",
          }}
        >
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
                ? "training — chat locked until the show closes"
                : activeModel.language === "fr"
                  ? "Demandez un poeme..."
                  : "Ask for a poem..."
            }
            maxRows={6}
            style={{
              flex: 1,
              fontFamily: '"Diatype Mono Variable", monospace',
              fontSize: "0.95rem",
              padding: "0.75rem 1rem",
              border: "1px solid var(--border-light)",
              borderRadius: "8px",
              resize: "none",
              outline: "none",
              lineHeight: 1.5,
              background: isTraining ? "rgba(0,0,0,0.04)" : "transparent",
              color: isTraining ? "var(--text-hint)" : "var(--text-primary)",
              cursor: isTraining ? "not-allowed" : "text",
            }}
          />
          <button
            type="submit"
            disabled={isTraining || !input.trim() || isLoading}
            style={{
              fontFamily: '"Diatype Mono Variable", monospace',
              fontSize: "0.85rem",
              padding: "0.75rem 1.25rem",
              border: "1px solid",
              borderColor:
                isTraining || !input.trim() || isLoading
                  ? "var(--border-light)"
                  : activeModel.color,
              borderRadius: "8px",
              background:
                isTraining || !input.trim() || isLoading
                  ? "transparent"
                  : activeModel.color,
              color:
                isTraining || !input.trim() || isLoading
                  ? "var(--text-hint)"
                  : readableForegroundOn(activeModel.color),
              cursor:
                isTraining || !input.trim() || isLoading
                  ? "not-allowed"
                  : "pointer",
              transition: "all 0.2s ease",
              whiteSpace: "nowrap",
            }}
          >
            {isLoading ? "..." : isTraining ? "Locked" : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Pull a human-readable message out of useChat's error. Our /api/chat
 * returns `{ "error": "..." }` on failure; ai@2 surfaces that body as
 * error.message. If it parses, show the server's message; otherwise show a
 * generic line.
 */
function parseChatError(raw: string | undefined): string {
  if (!raw) return "Something went wrong. Please try again.";
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.error === "string") return parsed.error;
  } catch {
    // not JSON - fall through
  }
  // Avoid dumping a giant HTML error page at the user.
  if (raw.length > 0 && raw.length < 200 && !raw.includes("<")) return raw;
  return "Something went wrong. Please try again.";
}

/* ---- Sub-components ---- */

function ModelSidebar({
  models,
  activeSlug,
  onSelect,
}: {
  models: Model[];
  activeSlug: ModelSlug;
  onSelect: (slug: ModelSlug) => void;
}) {
  return (
    <nav
      style={{
        width: 220,
        borderRight: "1px solid var(--border-light)",
        padding: "2rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
        flexShrink: 0,
      }}
      className="chat-sidebar"
    >
      <span
        style={{
          fontFamily: '"Diatype Mono Variable", monospace',
          fontSize: "0.7rem",
          color: "var(--text-hint)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "0.75rem",
        }}
      >
        Models
      </span>
      {models.map((model, idx) => {
        const isActive = model.slug === activeSlug;
        const isTraining = model.status === "training";
        // Insert a divider + "training" header before the first training
        // model when the previous entry was a trained one.
        const prev = models[idx - 1];
        const showTrainingDivider =
          isTraining && (!prev || prev.status !== "training");
        return (
          <React.Fragment key={model.slug}>
            {showTrainingDivider ? (
              <div
                aria-hidden
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginTop: "1rem",
                  marginBottom: "0.25rem",
                  paddingTop: "0.75rem",
                  borderTop: "1px solid var(--border-light)",
                }}
              >
                <span
                  style={{
                    fontFamily: '"Diatype Mono Variable", monospace',
                    fontSize: "0.65rem",
                    color: "var(--text-hint)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  training
                </span>
              </div>
            ) : null}
          <button
            onClick={() => onSelect(model.slug)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              padding: "0.5rem 0.75rem",
              border: "none",
              background: isActive ? "rgba(0,0,0,0.04)" : "transparent",
              borderRadius: "6px",
              cursor: "pointer",
              textAlign: "left",
              transition: "background 0.15s ease",
              fontFamily: '"Diatype Mono Variable", monospace',
              fontSize: "0.85rem",
              color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: isActive ? 600 : 400,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: model.color,
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1 }}>{model.displayName}</span>
            {isTraining ? (
              <span
                style={{
                  fontFamily: '"Diatype Mono Variable", monospace',
                  fontSize: "0.6rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  padding: "0.1rem 0.4rem",
                  border: "1px solid var(--text-primary)",
                  color: "var(--text-primary)",
                  borderRadius: "2px",
                  flexShrink: 0,
                }}
                aria-label="training - live during the current performance"
              >
                training
              </span>
            ) : null}
          </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

function MobileModelSelector({
  models,
  activeSlug,
  onSelect,
}: {
  models: Model[];
  activeSlug: ModelSlug;
  onSelect: (slug: ModelSlug) => void;
}) {
  const active = models.find((m) => m.slug === activeSlug)!;
  return (
    <div className="chat-mobile-selector">
      <select
        value={activeSlug}
        onChange={(e) => onSelect(e.target.value as ModelSlug)}
        style={{
          fontFamily: '"Diatype Mono Variable", monospace',
          fontSize: "0.85rem",
          padding: "0.4rem 0.6rem",
          border: "1px solid var(--border-light)",
          borderRadius: "6px",
          background: "transparent",
          color: "var(--text-primary)",
          cursor: "pointer",
          appearance: "none",
          paddingRight: "1.5rem",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 5l3 3 3-3' stroke='%23666' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 0.5rem center",
        }}
      >
        {models.map((m) => (
          <option key={m.slug} value={m.slug}>
            {m.displayName}
          </option>
        ))}
      </select>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: active.color,
          marginLeft: "0.5rem",
        }}
      />
    </div>
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
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        gap: "1.5rem",
      }}
    >
      {/* Model identity */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            backgroundColor: model.color,
          }}
        />
        <h1
          style={{
            fontFamily: '"Diatype Variable", sans-serif',
            fontSize: "1.5rem",
            fontWeight: 600,
            margin: 0,
          }}
        >
          {model.displayName}
        </h1>
      </div>

      <p
        style={{
          fontFamily: '"Standard", sans-serif',
          fontSize: "1.1rem",
          color: "var(--text-secondary)",
          maxWidth: 460,
          lineHeight: 1.5,
        }}
      >
        {model.language === "fr"
          ? "Je suis le rival d'Halim Madi. Une intelligence artificielle, un modele entraine sur le meilleur de la poesie francaise contemporaine."
          : "I am the rival of Halim Madi. An artificial intelligence, a model trained on the best of contemporary poetry."}
      </p>

      {/* Example prompts */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          width: "100%",
          maxWidth: 460,
        }}
      >
        {model.examplePrompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => onExampleClick(prompt)}
            style={{
              fontFamily: '"Diatype Mono Variable", monospace',
              fontSize: "0.85rem",
              padding: "0.75rem 1rem",
              border: "1px solid var(--border-light)",
              borderRadius: "8px",
              background: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
              textAlign: "left",
              transition: "border-color 0.2s ease, color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = model.color;
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-light)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Dataset link - omitted for models without a public dataset (e.g.
          frontière, which is not fine-tuned). */}
      {model.huggingFaceUrl ? (
        <a
          href={model.huggingFaceUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: '"Diatype Mono Variable", monospace',
            fontSize: "0.75rem",
            color: "var(--text-hint)",
            marginTop: "0.5rem",
          }}
        >
          Dataset on HuggingFace &rarr;
        </a>
      ) : null}
    </div>
  );
}

function MessageList({
  messages,
  model,
  isLoading,
}: {
  messages: { role: string; content: string; id: string }[];
  model: Model;
  isLoading: boolean;
}) {
  // Show the "generating" indicator while a request is in flight and the
  // model hasn't started streaming text yet (no assistant message, or an
  // empty one). Fine-tuned models can take a few seconds to first token -
  // without this the screen looks frozen/empty, which reads as broken.
  const last = messages[messages.length - 1];
  const showGenerating =
    isLoading &&
    (!last || last.role !== "assistant" || last.content.length === 0);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        paddingBottom: "2rem",
      }}
    >
      <style>{`
        @keyframes singularsBlink {
          0%, 80%, 100% { opacity: 0.2; }
          40% { opacity: 1; }
        }
        .gen-dot {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          margin-right: 5px;
          animation: singularsBlink 1.4s infinite both;
        }
      `}</style>
      {messages.map((message) => (
        <div
          key={message.id}
          style={{
            display: "flex",
            gap: "0.75rem",
            alignItems: "flex-start",
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              backgroundColor:
                message.role === "assistant" ? model.color : "transparent",
              border:
                message.role === "user"
                  ? "1.5px solid var(--border-light)"
                  : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: "0.15rem",
            }}
          >
            {message.role === "user" && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-hint)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </div>

          {/* Content */}
          <div
            style={{
              fontFamily: '"Diatype Mono Variable", monospace',
              fontSize: "0.95rem",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              color:
                message.role === "assistant"
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
              flex: 1,
            }}
          >
            {message.content}
          </div>
        </div>
      ))}

      {/* Generating indicator - animated dots in the model color, shown
          while waiting for the first streamed token. */}
      {showGenerating && (
        <div
          aria-live="polite"
          aria-label="Generating poem"
          style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              backgroundColor: model.color,
              flexShrink: 0,
              marginTop: "0.15rem",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: 28,
            }}
          >
            <span
              className="gen-dot"
              style={{ backgroundColor: model.color, animationDelay: "0s" }}
            />
            <span
              className="gen-dot"
              style={{ backgroundColor: model.color, animationDelay: "0.2s" }}
            />
            <span
              className="gen-dot"
              style={{ backgroundColor: model.color, animationDelay: "0.4s" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
