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
      "Get current live running status of a train. Supports specifying an optional start date (e.g. '02-June-2026') if multiple instances of the train are running.",
    inputSchema: {
      trainNo: z.string(),
      startDate: z.string().optional().describe("Optional start date of the train. Can be 'today', 'yesterday', or a specific date like '02-June-2026'."),
    },
  },
  async ({ trainNo, startDate }) => {
    console.error("========== TOOL CALLED ==========");
    console.error("Train:", trainNo, "Start Date:", startDate);

    const status = await getLiveTrainStatus(trainNo, startDate);

    console.error(
      "Result Status:",
      status.runningToday ? "Found" : "NotFound",
      "Train:",
      status.trainNo,
      "Start Date:",
      status.runningToday ? (status as any).startDate : "N/A"
    );
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
