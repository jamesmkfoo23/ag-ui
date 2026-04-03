# MAF Chat

A minimal AG-UI TypeScript SDK frontend for chatting with **Microsoft Agent Framework Python agents**.

## Features

- 🤖 **Real-time streaming** – Text streams token-by-token via the AG-UI event protocol
- 🔧 **Tool call display** – Shows tool calls and their results inline
- 📋 **Catalog forms** – Automatically renders A2UI selection forms when the agent returns catalog/list data (via `@ag-ui/mcp-a2ui-middleware`)
- ⚡ **Zero framework overhead** – Uses `@ag-ui/client` (HttpAgent) directly with React state

## Quick Start

### 1. Start the Python backend

```bash
cd integrations/microsoft-agent-framework/python/examples
cp .env.example .env  # fill in your OPENAI_API_KEY
uv run python agents/dojo.py
# Server starts on http://localhost:8888
```

### 2. Configure the frontend

```bash
cd apps/maf-chat
cp .env.example .env.local
# Edit .env.local if the Python server runs on a different port/host
```

### 3. Run the frontend

```bash
pnpm dev
# Open http://localhost:3000
```

## Architecture

```
Browser (React)
  └── Chat.tsx
        └── HttpAgent (@ag-ui/client)
              ├── MCPAppA2UIMiddleware (@ag-ui/mcp-a2ui-middleware)  ← optional
              └── HTTP POST → Microsoft Agent Framework Python server
                    (FastAPI + agent-framework-ag-ui)
```

### MCPAppA2UIMiddleware

When MCP servers are configured, the middleware:

1. Fetches tools from MCP servers and injects them into the agent's tool list.
2. Detects when tool results contain catalog/list data (arrays of named items).
3. Emits A2UI `ACTIVITY_DELTA` + `ACTIVITY_SNAPSHOT` events to render interactive selection forms.

```typescript
import { MCPAppA2UIMiddleware } from "@ag-ui/mcp-a2ui-middleware";

const agent = new HttpAgent({ url: "http://localhost:8888/agentic_chat" });

agent.use(new MCPAppA2UIMiddleware({
  mcpServers: [{ type: "http", url: "http://localhost:3100" }],
  catalogFormTitle: "Select a product",
  minCatalogItems: 2,
}));
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_AGENT_URL` | `http://localhost:8888/agentic_chat` | Microsoft Agent Framework Python endpoint |
| `NEXT_PUBLIC_MCP_SERVER_URL` | _(unset)_ | Optional MCP server for catalog tools |
