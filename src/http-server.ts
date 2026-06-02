import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { z } from "zod";
import express from "express";

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
    const status = await getLiveTrainStatus(trainNo);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(status, null, 2),
        },
      ],
    };
  },
);

const app = express();
app.use(express.json());
app.get("/sse", async (req, res) => {
  console.log("SSE request received");
  console.log("Host:", req.headers.host);
});

app.post("/messages", async (req, res) => {
  console.log("POST /messages");
  const sessionId = req.query.sessionId as string;

  const transport = transports[sessionId];

  if (!transport) {
    return res.status(404).send("Session not found");
  }

  await transport.handlePostMessage(req, res, req.body);
});

app.get("/", (req, res) => {
  res.send("ok");
});

app.listen(3000, () => {
  console.log("RailInfo MCP listening on http://localhost:3000/sse");
});

const transports: Record<string, SSEServerTransport> = {};
