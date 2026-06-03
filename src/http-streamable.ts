import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { registerAllTools } from "./tools/index.js";
import crypto from "crypto";

const app = express();

app.use(express.json());

// Enable CORS and adjust headers for SSE streaming compatibility
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");

  if (req.path === "/mcp" || req.url.startsWith("/mcp")) {
    req.headers["accept"] = "application/json, text/event-stream";
    
    let acceptIndex = -1;
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      if (req.rawHeaders[i].toLowerCase() === "accept") {
        acceptIndex = i;
        break;
      }
    }
    if (acceptIndex !== -1) {
      req.rawHeaders[acceptIndex + 1] = "application/json, text/event-stream";
    } else {
      req.rawHeaders.push("Accept", "application/json, text/event-stream");
    }
  }
  next();
});

// Initialize a single global MCP server
const server = new McpServer({
  name: "railinfo-mcp",
  version: "1.0.0",
});

// Register all tools to the global server
registerAllTools(server, { formatMarkdown: true });

// Initialize a single global transport with session support
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
});

// Keep track of the initialization state
let isInitialized = false;

// Route both GET (to establish SSE) and POST (to send JSON-RPC calls) to the transport
app.all("/mcp", async (req, res) => {
  console.error(`\n========== [${req.method}] /mcp ==========`);
  console.error(`Method: ${req.body?.method}, ID: ${req.body?.id}`);

  // Intercept duplicate initialize requests to prevent "Server already initialized" errors
  if (req.body?.method === "initialize") {
    if (isInitialized) {
      console.error("Server is already initialized. Intercepting and returning success...");
      return res.json({
        jsonrpc: "2.0",
        id: req.body.id,
        result: {
          protocolVersion: req.body.params?.protocolVersion || "2025-11-25",
          capabilities: {
            tools: {},
            resources: {},
            prompts: {}
          },
          serverInfo: {
            name: "railinfo-mcp",
            version: "1.0.0"
          }
        }
      });
    }
    isInitialized = true;
  }
  
  try {
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

// Establish the connection and start listening
const start = async () => {
  console.error("Connecting server to transport...");
  await server.connect(transport);
  
  app.listen(3000, () => {
    console.error("RailInfo Streamable MCP listening on port 3000");
  });
};

start().catch((err) => {
  console.error("Fatal startup error:", err);
});