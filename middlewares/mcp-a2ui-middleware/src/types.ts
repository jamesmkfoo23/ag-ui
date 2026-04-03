/**
 * MCP App A2UI Middleware - types
 *
 * Type definitions for the MCPAppA2UIMiddleware which combines
 * MCP server tool fetching with A2UI catalog form standardization.
 */

/**
 * MCP Client configuration for HTTP transport
 */
export interface MCPClientConfigHTTP {
  type: "http";
  url: string;
  serverId?: string;
}

/**
 * MCP Client configuration for SSE transport
 */
export interface MCPClientConfigSSE {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
  serverId?: string;
}

/**
 * MCP Client configuration
 */
export type MCPClientConfig = MCPClientConfigHTTP | MCPClientConfigSSE;

/**
 * A single item in a catalog
 */
export interface CatalogItem {
  /** Unique identifier for this item */
  id: string;
  /** Display name */
  name: string;
  /** Optional description */
  description?: string;
  /** Optional additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for MCPAppA2UIMiddleware
 */
export interface MCPAppA2UIMiddlewareConfig {
  /**
   * List of MCP server configurations to fetch catalog tools from.
   */
  mcpServers?: MCPClientConfig[];

  /**
   * Minimum number of items in a list result to treat it as a catalog.
   * Defaults to 2.
   */
  minCatalogItems?: number;

  /**
   * If true, injects the send_a2ui_json_to_client tool so the agent can
   * also render A2UI forms directly. Defaults to false.
   */
  injectA2UITool?: boolean;

  /**
   * Optional title for catalog form surfaces. Defaults to "Select an item".
   */
  catalogFormTitle?: string;
}

/**
 * Internal representation of a fetched catalog tool
 */
export interface CatalogToolInfo {
  /** AG-UI tool definition */
  tool: import("@ag-ui/client").Tool;
  /** Source server config */
  serverConfig: MCPClientConfig;
}
