# MCPAppA2UIMiddleware

Middleware for **AG-UI** that combines:
- **MCP (Model Context Protocol)** tool fetching from external servers
- **A2UI** catalog form rendering to standardize catalog/list data presentation

## Overview

When an agent calls an MCP tool that returns a **list of items** (a catalog), this middleware automatically generates A2UI surface events so the frontend can render an interactive selection form — without needing any extra agent instructions.

## Installation

```bash
pnpm add @ag-ui/mcp-a2ui-middleware
```

## Usage

```typescript
import { HttpAgent } from "@ag-ui/client";
import { MCPAppA2UIMiddleware } from "@ag-ui/mcp-a2ui-middleware";

const agent = new HttpAgent({ url: "http://localhost:8888/agentic_chat" });

agent.use(new MCPAppA2UIMiddleware({
  // Optional: MCP servers to fetch catalog tools from
  mcpServers: [
    { type: "http", url: "http://localhost:3100" },
    { type: "sse",  url: "http://localhost:3101/sse" },
  ],

  // Optional tuning
  minCatalogItems: 2,          // Minimum items to trigger catalog form (default: 2)
  catalogFormTitle: "Select",  // Title for catalog forms (default: "Select from <toolName>")
  injectA2UITool: false,       // Inject send_a2ui_json_to_client tool (default: false)
}));
```

## How Catalog Detection Works

The middleware inspects every `TOOL_CALL_RESULT` event. If the tool result JSON:

1. Is an array (or an object with an `items` / `results` / `data` / `content` array key)
2. Has at least `minCatalogItems` elements
3. Each element is an object with a `name`, `title`, `label`, or `displayName` string field

…then the result is treated as catalog data and A2UI form events are emitted.

## A2UI Events Emitted

For each detected catalog, the middleware emits:

- `ACTIVITY_DELTA` – Appends the A2UI operations to an existing activity message (if any)
- `ACTIVITY_SNAPSHOT` – Creates the activity message with `activityType: "mcp-a2ui-catalog"`

The `content` of the snapshot includes:
```ts
{
  operations: Array<Record<string, unknown>>,  // A2UI surfaceUpdate + beginRendering
  items: CatalogItem[],
  surfaceId: string,
  title: string,
}
```

## Catalog Form Structure (A2UI)

Each catalog renders as a vertical list where every item has:
- Its name (and optional description) on the left
- A **"Select"** button on the right that fires a `catalog_item_selected` action

## Types

```typescript
interface MCPAppA2UIMiddlewareConfig {
  mcpServers?: MCPClientConfig[];
  minCatalogItems?: number;
  injectA2UITool?: boolean;
  catalogFormTitle?: string;
}

interface CatalogItem {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
}
```
