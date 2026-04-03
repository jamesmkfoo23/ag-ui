import {
  Middleware,
  RunAgentInput,
  AbstractAgent,
  BaseEvent,
  Tool,
  EventType,
  Message,
  ToolCall,
  ToolCallResultEvent,
  ActivitySnapshotEvent,
  ActivityDeltaEvent,
  RunStartedEvent,
  RunFinishedEvent,
} from "@ag-ui/client";
import { Observable, from, switchMap } from "rxjs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { randomUUID, createHash } from "crypto";

import { MCPClientConfig, MCPClientConfigSSE, MCPAppA2UIMiddlewareConfig, CatalogItem, CatalogToolInfo } from "./types.js";

export * from "./types.js";

/**
 * Activity type used by this middleware for catalog form events.
 */
export const MCPAppA2UIActivityType = "mcp-a2ui-catalog";

/**
 * Extract EventWithState type from Middleware.runNextWithState return type
 */
type ExtractObservableType<T> = T extends Observable<infer U> ? U : never;
type RunNextWithStateReturn = ReturnType<Middleware["runNextWithState"]>;
type EventWithState = ExtractObservableType<RunNextWithStateReturn>;

/**
 * Generate a stable server hash from config using MD5 hash.
 */
function getServerHash(config: MCPClientConfig): string {
  const serialized = JSON.stringify({
    type: config.type,
    url: config.url,
    headers: config.type === "sse" ? (config as MCPClientConfigSSE).headers : undefined,
  });
  return createHash("md5").update(serialized).digest("hex");
}

/**
 * Convert MCP tool to AG-UI tool format.
 */
function convertMCPToolToAGUITool(mcpTool: {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}): Tool {
  return {
    name: mcpTool.name,
    description: mcpTool.description || "",
    parameters: mcpTool.inputSchema || { type: "object", properties: {} },
  };
}

/**
 * Try to detect catalog items from a tool result.
 * Returns an array of CatalogItem if the result looks like a catalog, otherwise null.
 */
function detectCatalogItems(
  content: string,
  minItems: number,
): CatalogItem[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  // Unwrap common result wrappers (e.g. { content: [...] } or { items: [...] } or { results: [...] })
  let arr: unknown = parsed;
  if (arr && typeof arr === "object" && !Array.isArray(arr)) {
    const obj = arr as Record<string, unknown>;
    if (Array.isArray(obj["content"])) arr = obj["content"];
    else if (Array.isArray(obj["items"])) arr = obj["items"];
    else if (Array.isArray(obj["results"])) arr = obj["results"];
    else if (Array.isArray(obj["data"])) arr = obj["data"];
    else return null;
  }

  if (!Array.isArray(arr) || arr.length < minItems) return null;

  // Each element should be an object with at least one string field that looks like a name/title
  const nameKeys = ["name", "title", "label", "displayName", "display_name"];
  const idKeys = ["id", "_id", "key", "code", "sku"];

  const items: CatalogItem[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;

    const obj = item as Record<string, unknown>;

    // Find a name field
    const nameKey = nameKeys.find((k) => typeof obj[k] === "string");
    if (!nameKey) return null;

    const name = obj[nameKey] as string;

    // Find or generate an id
    const idKey = idKeys.find((k) => obj[k] !== undefined);
    const id = idKey ? String(obj[idKey]) : randomUUID();

    // Find a description field
    const descKey = ["description", "desc", "summary", "details", "detail"].find(
      (k) => typeof obj[k] === "string",
    );
    const description = descKey ? (obj[descKey] as string) : undefined;

    // Collect remaining fields as metadata
    const reservedKeys = new Set([nameKey, ...(idKey ? [idKey] : []), ...(descKey ? [descKey] : [])]);
    const metadata: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (!reservedKeys.has(k) && v !== null && v !== undefined) {
        metadata[k] = v;
      }
    }

    items.push({ id, name, description, metadata: Object.keys(metadata).length > 0 ? metadata : undefined });
  }

  return items.length >= minItems ? items : null;
}

/**
 * Build A2UI JSON operations for a catalog selection form.
 *
 * Generates a surfaceUpdate + beginRendering pair following the A2UI protocol.
 * Each catalog item is represented as a Row with an item name and a "Select" button.
 */
function buildCatalogA2UIJson(
  surfaceId: string,
  title: string,
  items: CatalogItem[],
): Array<Record<string, unknown>> {
  const components: Array<Record<string, unknown>> = [];

  // Title text component
  components.push({
    id: "catalog-title",
    component: { Text: { text: { literalString: title }, style: { fontSize: 18, fontWeight: "bold" } } },
  });

  // Item rows
  const itemRowIds: string[] = [];
  for (const item of items) {
    const rowId = `item-row-${item.id}`;
    const nameId = `item-name-${item.id}`;
    const btnId = `item-btn-${item.id}`;
    const btnLabelId = `item-btn-label-${item.id}`;

    itemRowIds.push(rowId);

    components.push({
      id: nameId,
      component: {
        Text: {
          text: { literalString: item.description ? `${item.name} — ${item.description}` : item.name },
        },
      },
    });

    components.push({
      id: btnLabelId,
      component: { Text: { text: { literalString: "Select" } } },
    });

    components.push({
      id: btnId,
      component: {
        Button: {
          child: btnLabelId,
          action: {
            name: "catalog_item_selected",
            context: {
              itemId: { literalString: item.id },
              itemName: { literalString: item.name },
              surfaceId: { literalString: surfaceId },
            },
          },
        },
      },
    });

    components.push({
      id: rowId,
      component: {
        Row: {
          children: [nameId, btnId],
          style: { padding: 8, gap: 12, alignItems: "center" },
        },
      },
    });
  }

  // Root column containing title + all rows
  components.push({
    id: "catalog-root",
    component: {
      Column: {
        children: ["catalog-title", ...itemRowIds],
        style: { padding: 16, gap: 8 },
      },
    },
  });

  return [
    {
      surfaceUpdate: {
        surfaceId,
        components,
      },
    },
    {
      beginRendering: {
        surfaceId,
        root: "catalog-root",
      },
    },
  ];
}

/**
 * MCPAppA2UIMiddleware
 *
 * Middleware that fetches catalog tools from MCP servers and automatically
 * converts catalog tool results into A2UI selection forms, standardizing
 * how catalog data is presented to users.
 *
 * When a tool result contains a list of items (e.g. products, services, options),
 * this middleware emits A2UI ACTIVITY_DELTA + ACTIVITY_SNAPSHOT events so the
 * frontend can render an interactive catalog selection form.
 */
export class MCPAppA2UIMiddleware extends Middleware {
  private config: MCPAppA2UIMiddlewareConfig;
  private serverConfigMapByHash: Map<string, MCPClientConfig> = new Map();

  constructor(config: MCPAppA2UIMiddlewareConfig = {}) {
    super();
    this.config = config;
    for (const serverConfig of config.mcpServers || []) {
      const hash = getServerHash(serverConfig);
      this.serverConfigMapByHash.set(hash, serverConfig);
    }
  }

  run(input: RunAgentInput, next: AbstractAgent): Observable<BaseEvent> {
    if (!this.config.mcpServers?.length) {
      return this.processStream(this.runNextWithState(input, next));
    }

    return from(this.fetchCatalogTools()).pipe(
      switchMap((toolInfos) => {
        const enhancedInput: RunAgentInput = {
          ...input,
          tools: [...input.tools, ...toolInfos.map((t) => t.tool)],
        };
        return this.processStream(this.runNextWithState(enhancedInput, next), toolInfos);
      }),
    );
  }

  /**
   * Process the event stream, intercepting tool results to detect catalog data
   * and emit A2UI activity events for catalog selection forms.
   */
  private processStream(
    source: Observable<EventWithState>,
    catalogTools: CatalogToolInfo[] = [],
  ): Observable<BaseEvent> {
    const catalogToolNames = new Set(catalogTools.map((t) => t.tool.name));
    const minItems = this.config.minCatalogItems ?? 2;

    return new Observable<BaseEvent>((subscriber) => {
      // Track pending tool call names by toolCallId
      const toolCallNames = new Map<string, string>();
      let heldRunFinished: EventWithState | null = null;

      const sub = source.subscribe({
        next: (eventWithState) => {
          const event = eventWithState.event;

          if (heldRunFinished) {
            subscriber.next(heldRunFinished.event);
            heldRunFinished = null;
          }

          if (event.type === EventType.RUN_FINISHED) {
            heldRunFinished = eventWithState;
            return;
          }

          // Track which toolCallId maps to which tool name
          if (event.type === EventType.TOOL_CALL_START) {
            const e = event as import("@ag-ui/client").ToolCallStartEvent;
            toolCallNames.set(e.toolCallId, e.toolCallName);
          }

          subscriber.next(event);

          // After emitting a tool result, check if it's catalog data from an MCP tool
          if (event.type === EventType.TOOL_CALL_RESULT) {
            const resultEvent = event as ToolCallResultEvent;
            const toolName = toolCallNames.get(resultEvent.toolCallId);

            if (toolName && catalogToolNames.has(toolName) && resultEvent.content) {
              const items = detectCatalogItems(resultEvent.content, minItems);
              if (items) {
                const surfaceId = `catalog-${toolName}-${resultEvent.toolCallId.slice(0, 8)}`;
                const title = this.config.catalogFormTitle ?? `Select from ${toolName}`;
                const a2uiOperations = buildCatalogA2UIJson(surfaceId, title, items);

                // Emit ACTIVITY_DELTA
                const deltaEvent: ActivityDeltaEvent = {
                  type: EventType.ACTIVITY_DELTA,
                  messageId: `mcp-a2ui-${surfaceId}`,
                  activityType: MCPAppA2UIActivityType,
                  patch: a2uiOperations.map((op) => ({
                    op: "add" as const,
                    path: "/operations/-",
                    value: op,
                  })),
                };
                subscriber.next(deltaEvent);

                // Emit ACTIVITY_SNAPSHOT
                const snapshotEvent: ActivitySnapshotEvent = {
                  type: EventType.ACTIVITY_SNAPSHOT,
                  messageId: `mcp-a2ui-${surfaceId}`,
                  activityType: MCPAppA2UIActivityType,
                  content: { operations: a2uiOperations, items, surfaceId, title },
                  replace: false,
                };
                subscriber.next(snapshotEvent);
              }
            }
          }
        },

        error: (err) => {
          if (heldRunFinished) {
            subscriber.next(heldRunFinished.event);
            heldRunFinished = null;
          }
          subscriber.error(err);
        },

        complete: () => {
          if (heldRunFinished) {
            const pendingToolCalls = this.findPendingToolCalls(heldRunFinished.messages);
            const pendingCatalogCalls = pendingToolCalls.filter((tc) =>
              catalogToolNames.has(tc.function.name),
            );

            if (pendingCatalogCalls.length === 0) {
              subscriber.next(heldRunFinished.event);
              subscriber.complete();
              return;
            }

            // Execute all pending catalog tool calls concurrently, then flush
            const held = heldRunFinished;
            Promise.all(
              pendingCatalogCalls.map(async (toolCall) => {
                try {
                  const result = await this.executeToolCall(toolCall, catalogTools);
                  if (!result) return;

                  const content =
                    typeof result === "string" ? result : JSON.stringify(result);
                  const resultEvent: ToolCallResultEvent = {
                    type: EventType.TOOL_CALL_RESULT,
                    messageId: randomUUID(),
                    toolCallId: toolCall.id,
                    content,
                  };
                  subscriber.next(resultEvent);

                  const items = detectCatalogItems(content, minItems);
                  if (items) {
                    const surfaceId = `catalog-${toolCall.function.name}-${toolCall.id.slice(0, 8)}`;
                    const title =
                      this.config.catalogFormTitle ?? `Select from ${toolCall.function.name}`;
                    const a2uiOperations = buildCatalogA2UIJson(surfaceId, title, items);

                    subscriber.next({
                      type: EventType.ACTIVITY_DELTA,
                      messageId: `mcp-a2ui-${surfaceId}`,
                      activityType: MCPAppA2UIActivityType,
                      patch: a2uiOperations.map((op) => ({
                        op: "add" as const,
                        path: "/operations/-",
                        value: op,
                      })),
                    } as ActivityDeltaEvent);

                    subscriber.next({
                      type: EventType.ACTIVITY_SNAPSHOT,
                      messageId: `mcp-a2ui-${surfaceId}`,
                      activityType: MCPAppA2UIActivityType,
                      content: { operations: a2uiOperations, items, surfaceId, title },
                      replace: false,
                    } as ActivitySnapshotEvent);
                  }
                } catch (err) {
                  console.error(
                    `[MCPAppA2UIMiddleware] Failed to execute pending tool call ${toolCall.function.name}:`,
                    err,
                  );
                }
              }),
            ).finally(() => {
              subscriber.next(held.event);
              subscriber.complete();
            });

            return;
          }
          subscriber.complete();
        },
      });

      return () => sub.unsubscribe();
    });
  }

  /** Execute a pending tool call via MCP */
  private async executeToolCall(
    toolCall: ToolCall,
    catalogTools: CatalogToolInfo[],
  ): Promise<unknown> {
    const toolInfo = catalogTools.find((t) => t.tool.name === toolCall.function.name);
    if (!toolInfo) return null;

    const args = JSON.parse(toolCall.function.arguments || "{}");
    return this.callMCPTool(toolInfo.serverConfig, toolCall.function.name, args);
  }

  /** Find tool calls without results */
  private findPendingToolCalls(messages: Message[]): ToolCall[] {
    const allCalls: ToolCall[] = [];
    for (const msg of messages) {
      if (msg.role === "assistant" && "toolCalls" in msg && msg.toolCalls) {
        allCalls.push(...msg.toolCalls);
      }
    }
    const resolvedIds = new Set<string>();
    for (const msg of messages) {
      if (msg.role === "tool" && "toolCallId" in msg) {
        resolvedIds.add(msg.toolCallId);
      }
    }
    return allCalls.filter((tc) => !resolvedIds.has(tc.id));
  }

  /** Fetch all catalog tools from configured MCP servers */
  private async fetchCatalogTools(): Promise<CatalogToolInfo[]> {
    const results: CatalogToolInfo[] = [];
    for (const serverConfig of this.config.mcpServers || []) {
      try {
        const tools = await this.fetchToolsFromServer(serverConfig);
        results.push(...tools);
      } catch (err) {
        console.error(`[MCPAppA2UIMiddleware] Failed to fetch tools from ${serverConfig.url}:`, err);
      }
    }
    return results;
  }

  /** Fetch tools from a single MCP server */
  private async fetchToolsFromServer(serverConfig: MCPClientConfig): Promise<CatalogToolInfo[]> {
    const client = this.createMCPClient();
    const transport = this.createTransport(serverConfig);
    try {
      await client.connect(transport);
      const response = await client.listTools();
      return response.tools.map((t) => ({
        tool: convertMCPToolToAGUITool(t),
        serverConfig,
      }));
    } finally {
      await client.close();
    }
  }

  /** Call a tool on an MCP server */
  private async callMCPTool(
    serverConfig: MCPClientConfig,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const client = this.createMCPClient();
    const transport = this.createTransport(serverConfig);
    try {
      await client.connect(transport);
      return await client.callTool({ name: toolName, arguments: args });
    } finally {
      await client.close();
    }
  }

  private createMCPClient(): Client {
    return new Client(
      { name: "mcp-a2ui-middleware", version: "1.0.0" },
      { capabilities: {} },
    );
  }

  private createTransport(serverConfig: MCPClientConfig) {
    if (serverConfig.type === "sse") {
      return new SSEClientTransport(new URL(serverConfig.url));
    }
    return new StreamableHTTPClientTransport(new URL(serverConfig.url));
  }

  /** Handle a proxied MCP request (for RunFinished-only flows) */
  handleProxiedRequest(runId: string, serverHash: string): Observable<BaseEvent> {
    return new Observable<BaseEvent>((subscriber) => {
      const runStartedEvent: RunStartedEvent = {
        type: EventType.RUN_STARTED,
        runId,
        threadId: runId,
      };
      subscriber.next(runStartedEvent);

      const serverConfig = this.serverConfigMapByHash.get(serverHash);
      if (!serverConfig) {
        const runFinishedEvent: RunFinishedEvent = {
          type: EventType.RUN_FINISHED,
          runId,
          threadId: runId,
          result: { error: `Unknown server: ${serverHash}` },
        };
        subscriber.next(runFinishedEvent);
        subscriber.complete();
        return;
      }

      const runFinishedEvent: RunFinishedEvent = {
        type: EventType.RUN_FINISHED,
        runId,
        threadId: runId,
        result: { success: true },
      };
      subscriber.next(runFinishedEvent);
      subscriber.complete();
    });
  }
}
