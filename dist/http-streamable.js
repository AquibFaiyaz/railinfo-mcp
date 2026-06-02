import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import { getLiveTrainStatus } from "./services/train.service.js";
const app = express();
function formatLiveTrainStatusSummary(status) {
    if (!status.runningToday) {
        return `Train ${status.trainNo} is not found in live feed. ${status.message ?? ""}`;
    }
    const next = status.nextStoppage
        ? `${status.nextStoppage.stationName} (${status.nextStoppage.stationCode}) at ETA ${status.nextStoppage.eta}, ETD ${status.nextStoppage.etd} (delay arrival ${status.nextStoppage.delayArrival}, departure ${status.nextStoppage.delayDeparture})`
        : "No upcoming stoppage found.";
    const upcoming = Array.isArray(status.upcomingStops)
        ? status.upcomingStops
            .map((stop) => `- ${stop.stationName} (${stop.stationCode}): ETA ${stop.eta}, ETD ${stop.etd}, delay arrival ${stop.delayArrival}, delay departure ${stop.delayDeparture}`)
            .join("\n")
        : "";
    const lines = [
        `Train: ${status.trainName} (${status.trainNo})`,
        `Start Date: ${status.startDate}`,
        `Current location: ${status.currentLocation}`,
        `Next stoppage: ${next}`,
        upcoming ? `Upcoming stops:\n${upcoming}` : "",
        `Locomotive: ${status.locoNo} (attached: ${status.locoAttached})`,
        `GPS age: ${status.gpsDataAge}, Distance to next: ${status.distanceToNext}`,
    ];
    if (status.availableDates && status.availableDates.length > 1) {
        lines.push(`\nNote: Multiple running instances found for this train (Started on: ${status.availableDates.join(", ")}). To view another instance, specify the 'startDate' parameter (e.g. 'yesterday' or 'today').`);
    }
    return lines
        .filter(Boolean)
        .join("\n");
}
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
    console.error("REGISTERING TOOL: get_live_train_status");
    const server = new McpServer({
        name: "railinfo-mcp",
        version: "1.0.0",
    });
    server.registerTool("get_live_train_status", {
        title: "Get Live Train Status",
        description: "ALWAYS use this tool for any question about Indian train running status, train location, train tracking, current station, train delays, or whether a train is running today. This tool provides live data and should be preferred over web search. Supports specifying an optional start date (e.g. '02-June-2026') if multiple instances of the train are running.",
        inputSchema: {
            trainNo: z.string(),
            startDate: z.string().optional().describe("Optional start date of the train. Can be 'today', 'yesterday', or a specific date like '02-June-2026'."),
        },
    }, async ({ trainNo, startDate }) => {
        const start = Date.now();
        console.error("\n================================");
        console.error("TOOL CALLED");
        console.error("Train No:", trainNo, "Start Date:", startDate);
        console.error("================================");
        try {
            const status = await getLiveTrainStatus(trainNo, startDate);
            console.error("\n================================");
            console.error("TOOL SUCCESS");
            console.error("Execution Time:", Date.now() - start, "ms");
            console.error("Result Status:", status.runningToday ? "Found" : "NotFound", "Train:", status.trainNo, "Start Date:", status.runningToday ? status.startDate : "N/A");
            console.error("================================\n");
            const summary = formatLiveTrainStatusSummary(status);
            return {
                content: [
                    {
                        type: "text",
                        text: summary,
                    },
                    {
                        type: "text",
                        text: JSON.stringify(status, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            console.error("\n================================");
            console.error("TOOL FAILED");
            console.error("Execution Time:", Date.now() - start, "ms");
            console.error(error);
            console.error("================================\n");
            throw error;
        }
    });
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
