// MCP server endpoint — exposes Pokémon TCG card tools over Streamable HTTP.
// POST /api/public/mcp
import { createFileRoute } from "@tanstack/react-router";
import { createMcpServer } from "mcp-tanstack-start";
import {
  searchCardsTool,
  getCardTool,
  listSetsTool,
  getHDImageTool,
  refreshSetImagesTool,
} from "@/lib/mcp/tools/cards";

const mcp = createMcpServer({
  name: "pokevault-mcp",
  version: "1.0.0",
  instructions:
    "Tools for the PokéVault TCG catalog. Use `search_cards` for queries, `get_card` for full card details, `list_sets` to browse box sets, `get_hd_image` to fetch the best available artwork URL for a single card, and `refresh_set_images` to bulk-resolve HD URLs for every card in a set.",
  tools: [searchCardsTool, getCardTool, listSetsTool, getHDImageTool, refreshSetImagesTool],
});

const methodNotAllowed = () =>
  new Response(
    JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null }),
    { status: 405, headers: { "Content-Type": "application/json", Allow: "POST, OPTIONS" } },
  );

export const Route = createFileRoute("/api/public/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => mcp.handleRequest(request),
      GET: async () => methodNotAllowed(),
      DELETE: async () => methodNotAllowed(),
    },
  },
});
