import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import express from "express";
import { getLiveTrainStatus, getTrainsAtStation } from "./services/train.service.js";
const server = new McpServer({
    name: "railinfo-mcp",
    version: "1.0.0",
});
server.registerTool("get_live_train_status", {
    title: "Get Live Train Status",
    description: "Get current live running status of a train. Supports specifying an optional start date (e.g. '02-June-2026') if multiple instances of the train are running.",
    inputSchema: {
        trainNo: z.string(),
        startDate: z.string().optional().describe("Optional start date of the train. Can be 'today', 'yesterday', or a specific date like '02-June-2026'."),
    },
}, async ({ trainNo, startDate }) => {
    const status = await getLiveTrainStatus(trainNo, startDate);
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(status, null, 2),
            },
        ],
    };
});
server.registerTool("get_trains_at_station", {
    title: "Get Trains at Station (Live Station)",
    description: "Get all trains arriving at or departing from a station in the next specified hours (default 2 hours). Supports 2 or 4 hours window.",
    inputSchema: {
        stationCode: z.string().describe("The 3-4 letter station code (e.g. 'NDLS', 'KIR', 'HWH')"),
        hours: z.number().optional().default(2).describe("Time window in hours (default: 2, can be 2 or 4)"),
    },
}, async ({ stationCode, hours }) => {
    const trains = await getTrainsAtStation(stationCode, hours);
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(trains, null, 2),
            },
        ],
    };
});
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
