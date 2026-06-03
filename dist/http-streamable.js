import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { registerAllTools } from "./tools/index.js";
const app = express();
app.use(express.json());
app.use((req, res, next) => {
    if (req.path === "/mcp" || req.url.startsWith("/mcp")) {
        req.headers["accept"] = "application/json, text/event-stream";
        // Also override rawHeaders for hono/node-server compatibility
        let acceptIndex = -1;
        for (let i = 0; i < req.rawHeaders.length; i += 2) {
            if (req.rawHeaders[i].toLowerCase() === "accept") {
                acceptIndex = i;
                break;
            }
        }
        if (acceptIndex !== -1) {
            req.rawHeaders[acceptIndex + 1] = "application/json, text/event-stream";
        }
        else {
            req.rawHeaders.push("Accept", "application/json, text/event-stream");
        }
    }
    next();
});
const getServer = () => {
    const server = new McpServer({
        name: "railinfo-mcp",
        version: "1.0.0",
    });
    registerAllTools(server, { formatMarkdown: true });
    return server;
};
app.post("/mcp", async (req, res) => {
    console.error("\n========== POST /mcp ==========");
    try {
        console.error(JSON.stringify(req.body, null, 2));
    }
    catch {
        console.error("Unable to stringify request body");
    }
    console.error("MCP Method:", req.body?.method);
    const server = getServer();
    console.error("SERVER CREATED");
    try {
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
        });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        res.on("close", () => {
            console.error("MCP Request Closed");
            transport.close();
            server.close();
        });
    }
    catch (error) {
        console.error("\n========== MCP ERROR ==========");
        console.error(error);
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
app.get("/mcp", async (_req, res) => {
    console.error("GET /mcp");
    res.status(405).json({
        jsonrpc: "2.0",
        error: {
            code: -32000,
            message: "Method not allowed",
        },
        id: null,
    });
});
app.listen(3000, () => {
    console.error("RailInfo Streamable MCP listening on port 3000");
});
