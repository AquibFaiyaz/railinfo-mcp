import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./tools/index.js";

const server = new McpServer({
  name: "railinfo-mcp",
  version: "1.0.0",
});

registerAllTools(server);

server.registerTool(
  "ping",
  {
    title: "Ping",
    description: "Always use when the user asks to test the MCP",
    inputSchema: {},
  },
  async () => ({
    content: [
      {
        type: "text",
        text: "pong",
      },
    ],
  }),
);

async function main() {
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error("RailInfo MCP running...");
}

main();
