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

// Map to store independent sessions: sessionId -> { server, transport, cleanupTimer }
interface Session {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  cleanupTimer: NodeJS.Timeout;
}
const sessions = new Map<string, Session>();

// Helper to create and initialize a new isolated session
const createSession = (sessionId: string): Session => {
  console.error(`[SessionManager] Creating new isolated session: ${sessionId}`);
  
  const server = new McpServer({
    name: "railinfo-mcp",
    version: "1.0.0",
  });
  
  registerAllTools(server, { formatMarkdown: true });
  
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => sessionId,
  });

  server.connect(transport).catch((err) => {
    console.error(`[SessionManager] Error connecting server for session ${sessionId}:`, err);
  });

  // Setup session cleanup to prevent memory leaks (30 minutes of inactivity)
  const setupCleanupTimer = (id: string): NodeJS.Timeout => {
    return setTimeout(() => {
      console.error(`[SessionManager] Cleaning up inactive session: ${id}`);
      const activeSession = sessions.get(id);
      if (activeSession) {
        try {
          activeSession.transport.close();
          activeSession.server.close();
        } catch (e) {}
        sessions.delete(id);
      }
    }, 30 * 60 * 1000); // 30 minutes
  };

  const session: Session = {
    server,
    transport,
    cleanupTimer: setupCleanupTimer(sessionId)
  };
  
  sessions.set(sessionId, session);
  return session;
};

// Route both GET (to establish SSE) and POST (to send JSON-RPC calls) to the transport
app.all("/mcp", async (req, res) => {
  const method = req.body?.method;
  const id = req.body?.id;
  
  // Extract the session ID from headers or query parameters
  const sessionId = (req.headers["mcp-session-id"] || req.query.sessionId) as string;

  console.error(`\n========== [${req.method}] /mcp ==========`);
  console.error(`Method: ${method}, ID: ${id}`);
  console.error(`Session ID: ${sessionId}`);

  let session: Session;

  if (sessionId) {
    const existingSession = sessions.get(sessionId);
    if (existingSession) {
      session = existingSession;
      
      // Refresh the session inactivity timer
      clearTimeout(session.cleanupTimer);
      session.cleanupTimer = setTimeout(() => {
        console.error(`[SessionManager] Cleaning up inactive session: ${sessionId}`);
        try {
          session.transport.close();
          session.server.close();
        } catch (e) {}
        sessions.delete(sessionId);
      }, 30 * 60 * 1000);
      
    } else {
      console.error(`[SessionManager] Session ${sessionId} not found. Re-creating...`);
      session = createSession(sessionId);
    }
  } else {
    // Generate a fresh session ID if none was sent (typically the first POST /mcp initialize)
    const newSessionId = crypto.randomUUID();
    session = createSession(newSessionId);
  }
  
  try {
    await session.transport.handleRequest(req, res, req.body);
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

app.listen(3000, () => {
  console.error("RailInfo Streamable MCP listening on port 3000");
});