import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getLiveTrainStatus, getTrainsAtStation } from "./services/train.service.js";
const server = new McpServer({
    name: "railinfo-mcp",
    version: "1.0.0",
});
server.registerTool("get_live_train_status", {
    title: "Get Live Train Status",
    description: "Get current live running status of a train. Supports specifying an optional start date (e.g. '02-June-2026') if multiple instances of the train are running, and an optional target station code to get localized details relative to that station.",
    inputSchema: {
        trainNo: z.string(),
        startDate: z.string().optional().describe("Optional start date of the train. Can be 'today', 'yesterday', or a specific date like '02-June-2026'."),
        targetStationCode: z.string().optional().describe("Optional 3-4 letter station code (e.g. 'BSB', 'NDLS') to focus status details relative to this target station."),
    },
}, async ({ trainNo, startDate, targetStationCode }) => {
    console.error("========== TOOL CALLED ==========");
    console.error("Train:", trainNo, "Start Date:", startDate, "Target Station:", targetStationCode);
    const status = await getLiveTrainStatus(trainNo, startDate, targetStationCode);
    console.error("Result Status:", status.runningToday ? "Found" : "NotFound", "Train:", status.trainNo, "Start Date:", status.runningToday ? status.startDate : "N/A");
    console.error("========== TOOL END ==========");
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
    console.error("========== TOOL CALLED ==========");
    console.error("Station:", stationCode, "Hours:", hours);
    const trains = await getTrainsAtStation(stationCode, hours);
    console.error("Result Count:", trains.length);
    console.error("========== TOOL END ==========");
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(trains, null, 2),
            },
        ],
    };
});
server.registerTool("ping", {
    title: "Ping",
    description: "Always use when the user asks to test the MCP",
    inputSchema: {},
}, async () => ({
    content: [
        {
            type: "text",
            text: "pong",
        },
    ],
}));
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("RailInfo MCP running...");
}
main();
