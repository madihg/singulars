"use client";

import { useState, useCallback } from "react";
import { useChat } from "ai/react";
import TextareaAutosize from "react-textarea-autosize";
import { MODELS, type Model, type ModelSlug } from "@/lib/models";

export default function ChatPage() {
  const [activeSlug, setActiveSlug] = useState<ModelSlug>(MODELS[0].slug);
  const activeModel = MODELS.find((m) => m.slug === activeSlug)!;

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    setMessages,
    error,
  } = useChat({
    api: "/api/chat",
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
        models={MODELS}
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
            models={MODELS}
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
            <MessageList messages={messages} model={activeModel} />
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
            Something went wrong. Please try again.
          </p>
        )}

        {/* Input */}
        <form
          data-chat-form
          onSubmit={handleSubmit}
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
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const form = e.currentTarget.closest("form");
                form?.requestSubmit();
              }
            }}
            placeholder={
              activeModel.language === "fr"
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
              background: "transparent",
              color: "var(--text-primary)",
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            style={{
              fontFamily: '"Diatype Mono Variable", monospace',
              fontSize: "0.85rem",
              padding: "0.75rem 1.25rem",
              border: "1px solid",
              borderColor:
                !input.trim() || isLoading
                  ? "var(--border-light)"
                  : activeModel.color,
              borderRadius: "8px",
              background:
                !input.trim() || isLoading ? "transparent" : activeModel.color,
              color: !input.trim() || isLoading ? "var(--text-hint)" : "#000",
              cursor: !input.trim() || isLoading ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
              whiteSpace: "nowrap",
            }}
          >
            {isLoading ? "..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
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
      {models.map((model) => {
        const isActive = model.slug === activeSlug;
        return (
          <button
            key={model.slug}
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
            {model.displayName}
          </button>
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

      {/* Dataset link */}
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
    </div>
  );
}

function MessageList({
  messages,
  model,
}: {
  messages: { role: string; content: string; id: string }[];
  model: Model;
}) {
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
    </div>
  );
}
