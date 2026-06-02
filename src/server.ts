import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { getLiveTrainStatus } from "./services/train.service.js";

const server = new McpServer({
  name: "railinfo-mcp",
  version: "1.0.0",
});

server.registerTool(
  "get_live_train_status",
  {
    title: "Get Live Train Status",
    description:
      "Get current live running status of a train and determine if it is running today",
    inputSchema: {
      trainNo: z.string(),
    },
  },
  async ({ trainNo }) => {
  console.error("========== TOOL CALLED ==========");
  console.error("Train:", trainNo);

  const status = await getLiveTrainStatus(trainNo);

  console.error("Result:", status);
  console.error("========== TOOL END ==========");

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(status, null, 2),
      },
    ],
  };
}
);

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
