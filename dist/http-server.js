import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import express from "express";
import { registerAllTools } from "./tools/index.js";
const server = new McpServer({
    name: "railinfo-mcp",
    version: "1.0.0",
});
registerAllTools(server);
const app = express();
app.use(express.json());
app.get("/sse", async (req, res) => {
    console.log("SSE request received");
    console.log("Host:", req.headers.host);
});
app.post("/messages", async (req, res) => {
    console.log("POST /messages");
    const sessionId = req.query.sessionId;
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
const transports = {};
