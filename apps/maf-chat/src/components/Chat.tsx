"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import { HttpAgent } from "@ag-ui/client";
import { v4 as uuidv4 } from "uuid";

// ─── Types ───────────────────────────────────────────────────────────────────

type MessageRole = "user" | "assistant" | "tool" | "catalog";

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  toolCallId?: string;
  toolName?: string;
  /** Catalog form data if this is a catalog activity message */
  catalogData?: {
    surfaceId: string;
    title: string;
    items: Array<{ id: string; name: string; description?: string }>;
  };
}

// ─── Styles (inline – no extra deps) ─────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
    background: "#0f172a",
  },
  header: {
    padding: "16px 20px",
    borderBottom: "1px solid #1e293b",
    background: "#0f172a",
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: "#f1f5f9",
    margin: 0,
  },
  headerSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  messages: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minHeight: 0,
  },
  userBubble: {
    alignSelf: "flex-end",
    background: "#3b82f6",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: "12px 12px 2px 12px",
    maxWidth: "75%",
    fontSize: 14,
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  assistantBubble: {
    alignSelf: "flex-start",
    background: "#1e293b",
    color: "#e2e8f0",
    padding: "10px 14px",
    borderRadius: "12px 12px 12px 2px",
    maxWidth: "75%",
    fontSize: 14,
    lineHeight: 1.5,
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
  },
  toolBubble: {
    alignSelf: "flex-start",
    background: "#0f2d1e",
    border: "1px solid #166534",
    color: "#86efac",
    padding: "8px 14px",
    borderRadius: 8,
    maxWidth: "75%",
    fontSize: 12,
    fontFamily: "monospace",
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  catalogCard: {
    alignSelf: "flex-start",
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 10,
    maxWidth: "75%",
    overflow: "hidden",
  },
  catalogHeader: {
    padding: "10px 14px",
    borderBottom: "1px solid #334155",
    fontSize: 14,
    fontWeight: 600,
    color: "#f1f5f9",
  },
  catalogItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 14px",
    borderBottom: "1px solid #1e293b",
    gap: 12,
  },
  catalogItemName: {
    fontSize: 13,
    color: "#e2e8f0",
    flex: 1,
  },
  catalogItemDesc: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  selectButton: {
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 12,
    cursor: "pointer",
    flexShrink: 0,
  },
  inputRow: {
    display: "flex",
    gap: 8,
    padding: "12px 20px",
    borderTop: "1px solid #1e293b",
    background: "#0f172a",
    flexShrink: 0,
  },
  input: {
    flex: 1,
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#e2e8f0",
    fontSize: 14,
    outline: "none",
    resize: "none" as const,
    lineHeight: 1.5,
  },
  sendButton: {
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    flexShrink: 0,
    alignSelf: "flex-end",
    opacity: 1,
    transition: "opacity 0.15s",
  },
  sendButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  typing: {
    alignSelf: "flex-start",
    color: "#64748b",
    fontSize: 13,
    padding: "4px 0",
  },
  empty: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    color: "#334155",
    fontSize: 14,
    gap: 8,
    textAlign: "center" as const,
  },
};

// ─── CatalogCard component ────────────────────────────────────────────────────

function CatalogCard({
  data,
  onSelect,
}: {
  data: NonNullable<ChatMessage["catalogData"]>;
  onSelect: (item: { id: string; name: string }) => void;
}) {
  return (
    <div style={styles.catalogCard}>
      <div style={styles.catalogHeader}>{data.title}</div>
      {data.items.map((item) => (
        <div key={item.id} style={styles.catalogItem}>
          <div>
            <div style={styles.catalogItemName}>{item.name}</div>
            {item.description && (
              <div style={styles.catalogItemDesc}>{item.description}</div>
            )}
          </div>
          <button
            style={styles.selectButton}
            onClick={() => onSelect({ id: item.id, name: item.name })}
          >
            Select
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Main Chat component ──────────────────────────────────────────────────────

interface ChatProps {
  agentUrl: string;
}

export default function Chat({ agentUrl }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const agentRef = useRef<HttpAgent | null>(null);

  /** Lazily create/reuse the HttpAgent so message history persists across turns. */
  const getAgent = useCallback((): HttpAgent => {
    if (!agentRef.current) {
      agentRef.current = new HttpAgent({ url: agentUrl });
    }
    return agentRef.current;
  }, [agentUrl]);

  /** Scroll to the bottom whenever messages change. */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /** Send a user message and stream the agent response. */
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const agent = getAgent();

      // Add the user message to the UI and to the agent's message history
      const userMsgId = uuidv4();
      const userMsg: ChatMessage = { id: userMsgId, role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");

      agent.messages.push({ id: userMsgId, role: "user", content: trimmed });

      setIsLoading(true);

      try {
        await agent.runAgent(
          {},
          {
            onTextMessageStartEvent({ event }) {
              setMessages((prev) => [
                ...prev,
                { id: event.messageId, role: "assistant", content: "" },
              ]);
            },

            onTextMessageContentEvent({ event }) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === event.messageId
                    ? { ...m, content: m.content + event.delta }
                    : m,
                ),
              );
            },

            onToolCallStartEvent({ event }) {
              setMessages((prev) => [
                ...prev,
                {
                  id: event.toolCallId,
                  role: "tool",
                  content: "",
                  toolCallId: event.toolCallId,
                  toolName: event.toolCallName,
                },
              ]);
            },

            onToolCallArgsEvent({ event }) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.toolCallId === event.toolCallId
                    ? { ...m, content: m.content + event.delta }
                    : m,
                ),
              );
            },

            onToolCallResultEvent({ event }) {
              const resultText = event.content ?? "";
              setMessages((prev) =>
                prev.map((m) =>
                  m.toolCallId === event.toolCallId
                    ? { ...m, content: `Result: ${resultText}` }
                    : m,
                ),
              );
            },

            onActivitySnapshotEvent({ event }) {
              // Render MCP A2UI catalog form activity events
              if (
                event.activityType === "mcp-a2ui-catalog" &&
                typeof event.content === "object" &&
                event.content !== null
              ) {
                const content = event.content as {
                  surfaceId?: string;
                  title?: string;
                  items?: Array<{ id: string; name: string; description?: string }>;
                };
                if (content.items && content.surfaceId && content.title) {
                  setMessages((prev) => {
                    // Replace existing entry for this surface or append
                    const exists = prev.some((m) => m.id === event.messageId);
                    const catalogMsg: ChatMessage = {
                      id: event.messageId,
                      role: "catalog",
                      content: content.title!,
                      catalogData: {
                        surfaceId: content.surfaceId!,
                        title: content.title!,
                        items: content.items!,
                      },
                    };
                    return exists
                      ? prev.map((m) => (m.id === event.messageId ? catalogMsg : m))
                      : [...prev, catalogMsg];
                  });
                }
              }
            },
          },
        );
      } finally {
        setIsLoading(false);
      }
    },
    [getAgent, isLoading],
  );

  /** When the user selects a catalog item, send it as a follow-up message. */
  const handleCatalogSelect = useCallback(
    (item: { id: string; name: string }) => {
      sendMessage(`I select "${item.name}" (id: ${item.id})`);
    },
    [sendMessage],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <p style={styles.headerTitle}>Microsoft Agent Framework Chat</p>
        <p style={styles.headerSub}>
          Connected to: <code style={{ fontSize: 11, color: "#94a3b8" }}>{agentUrl}</code>
        </p>
      </div>

      {/* Messages */}
      <div style={styles.messages}>
        {messages.length === 0 && !isLoading && (
          <div style={styles.empty}>
            <span style={{ fontSize: 32 }}>🤖</span>
            <span>Start a conversation with the agent</span>
            <span style={{ fontSize: 12, color: "#475569" }}>
              Powered by Microsoft Agent Framework + AG-UI TypeScript SDK
            </span>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.role === "user") {
            return (
              <div key={msg.id} style={styles.userBubble}>
                {msg.content}
              </div>
            );
          }
          if (msg.role === "assistant") {
            return (
              <div key={msg.id} style={styles.assistantBubble}>
                {msg.content || <span style={{ color: "#475569" }}>…</span>}
              </div>
            );
          }
          if (msg.role === "tool") {
            return (
              <div key={msg.id} style={styles.toolBubble}>
                <span style={{ opacity: 0.7 }}>🔧 {msg.toolName ?? "tool"}</span>
                {msg.content ? (
                  <>
                    <br />
                    {msg.content}
                  </>
                ) : null}
              </div>
            );
          }
          if (msg.role === "catalog" && msg.catalogData) {
            return (
              <CatalogCard
                key={msg.id}
                data={msg.catalogData}
                onSelect={handleCatalogSelect}
              />
            );
          }
          return null;
        })}

        {isLoading && <div style={styles.typing}>Agent is typing…</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={styles.inputRow}>
        <textarea
          style={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
          rows={1}
          disabled={isLoading}
        />
        <button
          style={{
            ...styles.sendButton,
            ...(isLoading || !input.trim() ? styles.sendButtonDisabled : {}),
          }}
          onClick={() => sendMessage(input)}
          disabled={isLoading || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
