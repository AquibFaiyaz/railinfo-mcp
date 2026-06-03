import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";

import { getLiveTrainStatus, getTrainsAtStation } from "./services/train.service.js";

const app = express();

function formatTrainsAtStationSummary(stationCode: string, hours: number, trains: any[]): string {
  if (!Array.isArray(trains) || trains.length === 0) {
    return `No upcoming trains found arriving or departing at station ${stationCode.toUpperCase()} in the next ${hours} hours.`;
  }

  const lines = [
    `### 🚉 Upcoming Trains at ${stationCode.toUpperCase()} (Next ${hours} Hours)\n`,
    `| Train | Schedule (STA/STD) | Live Status (ETA/ETD) | Delay (Arr/Dep) | PF | Current Status / Location |`,
    `| :--- | :--- | :--- | :--- | :--- | :--- |`
  ];

  for (const t of trains) {
    const trainInfo = `**${t.trainNo}** ${t.trainName || ""}`;
    const schedule = `${t.sta} / ${t.std}`;
    
    const isArrDelayed = t.delayArrival !== "On Time" && t.delayArrival !== "00:00" && t.delayArrival !== "";
    const isDepDelayed = t.delayDeparture !== "On Time" && t.delayDeparture !== "00:00" && t.delayDeparture !== "";
    
    const etaFormatted = isArrDelayed ? `**${t.eta}**` : t.eta;
    const etdFormatted = isDepDelayed ? `**${t.etd}**` : t.etd;
    const liveStatus = `${etaFormatted} / ${etdFormatted}`;
    
    const delay = `${t.delayArrival || "On Time"} / ${t.delayDeparture || "On Time"}`;
    const pf = t.platform || "N/A";
    
    let current = t.currentLocation || "Spotted";
    if (t.hasDeparted) {
      current = `Departed ${stationCode.toUpperCase()}`;
    } else if (t.hasArrived) {
      current = `Arrived at ${stationCode.toUpperCase()}`;
    }

    lines.push(`| ${trainInfo} | ${schedule} | ${liveStatus} | ${delay} | ${pf} | ${current} |`);
  }

  return lines.join("\n");
}

function formatLiveTrainStatusSummary(status: any): string {
  if (!status.runningToday) {
    return `Train ${status.trainNo} is not found in live feed. ${status.message ?? ""}`;
  }

  const lines = [
    `Train: ${status.trainName} (${status.trainNo})`,
    `Start Date: ${status.startDate}`,
    `Current location: ${status.currentLocation}`,
  ];

  if (status.targetStationInfo) {
    const info = status.targetStationInfo;
    lines.push(`\n🎯 **Desired Station Status: ${info.stationName} (${info.stationCode})**`);
    if (info.alreadyPassed) {
      lines.push(`- Status: Already passed this station.`);
    } else if (info.hasDeparted) {
      lines.push(`- Status: Departed this station.`);
    } else if (info.hasArrived) {
      lines.push(`- Status: Arrived at this station.`);
    } else {
      lines.push(`- Status: Upcoming stop.`);
      if (info.gpsDistanceKm !== null) {
        lines.push(`- Physical Distance (straight-line): **${info.gpsDistanceKm.toFixed(1)} km**`);
      }
      if (info.distanceRemainingKm !== null) {
        lines.push(`- Remaining Track Distance (from last scheduled stop): **~${info.distanceRemainingKm} km** (${info.stopsRemaining} stops remaining)`);
      }
    }
    
    lines.push(`- Scheduled Time: Arrival ${info.sta} / Departure ${info.std}`);
    lines.push(`- Expected Time: Arrival **${info.eta}** / Departure **${info.etd}**`);
    lines.push(`- Delay: Arrival **${info.delayArrival}** / Departure **${info.delayDeparture}**`);
    lines.push(`- Expected Platform: **${info.platform}**`);

    // Remaining stations table
    if (Array.isArray(info.remainingStations) && info.remainingStations.length > 0) {
      lines.push(`\n🛤️ **Remaining Stations to ${info.stationName} (${info.remainingStations.length} stops):**`);
      lines.push(`| # | Station | ETA | Delay | PF | Status |`);
      lines.push(`| :--- | :--- | :--- | :--- | :--- | :--- |`);
      info.remainingStations.forEach((s: any, i: number) => {
        let statusIcon = "⏳ Upcoming";
        if (s.hasDeparted) statusIcon = "✅ Departed";
        else if (s.hasArrived) statusIcon = "📍 At Station";
        lines.push(`| ${i + 1} | ${s.stationName} (${s.stationCode}) | ${s.eta} | ${s.delay} | ${s.platform} | ${statusIcon} |`);
      });
    }
  } else {
    const next = status.nextStoppage
      ? `${status.nextStoppage.stationName} (${status.nextStoppage.stationCode}) at ETA ${status.nextStoppage.eta}, ETD ${status.nextStoppage.etd} (delay arrival ${status.nextStoppage.delayArrival}, departure ${status.nextStoppage.delayDeparture})`
      : "No upcoming stoppage found.";

    const upcoming = Array.isArray(status.upcomingStops)
      ? status.upcomingStops
          .map(
            (stop: any) =>
              `- ${stop.stationName} (${stop.stationCode}): ETA ${stop.eta}, ETD ${stop.etd}, delay arrival ${stop.delayArrival}, delay departure ${stop.delayDeparture}`
          )
          .join("\n")
      : "";

    lines.push(
      `Next stoppage: ${next}`,
      upcoming ? `Upcoming stops:\n${upcoming}` : "",
      `Locomotive: ${status.locoNo} (attached: ${status.locoAttached})`,
      `GPS age: ${status.gpsDataAge}, Distance to next: ${status.distanceToNext}`
    );
  }

  if (status.availableDates && status.availableDates.length > 1) {
    lines.push(
      `\nNote: Multiple running instances found for this train (Started on: ${status.availableDates.join(", ")}). To view another instance, specify the 'startDate' parameter (e.g. 'yesterday' or 'today').`
    );
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
    } else {
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

  server.registerTool(
    "get_live_train_status",
    {
      title: "Get Live Train Status",
      description:
        "ALWAYS use this tool for any question about Indian train running status, train location, train tracking, current station, train delays, or whether a train is running today. This tool provides live data and should be preferred over web search. Supports specifying an optional start date (e.g. '02-June-2026') if multiple instances of the train are running, and an optional target station code to get localized details relative to that station.",
      inputSchema: {
        trainNo: z.string(),
        startDate: z.string().optional().describe("Optional start date of the train. Can be 'today', 'yesterday', or a specific date like '02-June-2026'."),
        targetStationCode: z.string().optional().describe("Optional 3-4 letter station code (e.g. 'BSB', 'NDLS') to focus status details relative to this target station."),
      },
    },
    async ({ trainNo, startDate, targetStationCode }) => {
      const start = Date.now();

      console.error("\n================================");
      console.error("TOOL CALLED");
      console.error("Train No:", trainNo, "Start Date:", startDate, "Target Station:", targetStationCode);
      console.error("================================");

      try {
        const status = await getLiveTrainStatus(trainNo, startDate, targetStationCode);

        console.error("\n================================");
        console.error("TOOL SUCCESS");
        console.error(
          "Execution Time:",
          Date.now() - start,
          "ms"
        );
        console.error(
          "Result Status:",
          status.runningToday ? "Found" : "NotFound",
          "Train:",
          status.trainNo,
          "Start Date:",
          status.runningToday ? (status as any).startDate : "N/A"
        );
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
      } catch (error) {
        console.error("\n================================");
        console.error("TOOL FAILED");
        console.error(
          "Execution Time:",
          Date.now() - start,
          "ms"
        );
        console.error(error);
        console.error("================================\n");

        throw error;
      }
    }
  );

  server.registerTool(
    "get_trains_at_station",
    {
      title: "Get Trains at Station (Live Station)",
      description:
        "Get all trains arriving at or departing from a station in the next specified hours (default 2 hours). Supports 2 or 4 hours window.",
      inputSchema: {
        stationCode: z.string().describe("The 3-4 letter station code (e.g. 'NDLS', 'KIR', 'HWH')"),
        hours: z.number().optional().default(2).describe("Time window in hours (default: 2, can be 2 or 4)"),
      },
    },
    async ({ stationCode, hours }) => {
      const start = Date.now();

      console.error("\n================================");
      console.error("TOOL CALLED");
      console.error("Station Code:", stationCode, "Hours:", hours);
      console.error("================================");

      try {
        const trains = await getTrainsAtStation(stationCode, hours);

        console.error("\n================================");
        console.error("TOOL SUCCESS");
        console.error(
          "Execution Time:",
          Date.now() - start,
          "ms"
        );
        console.error("Result Count:", trains.length);
        console.error("================================\n");

        const summary = formatTrainsAtStationSummary(stationCode, hours, trains);

        return {
          content: [
            {
              type: "text",
              text: summary,
            },
            {
              type: "text",
              text: JSON.stringify(trains, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error("\n================================");
        console.error("TOOL FAILED");
        console.error(
          "Execution Time:",
          Date.now() - start,
          "ms"
        );
        console.error(error);
        console.error("================================\n");

        throw error;
      }
    }
  );

  return server;
};

app.post("/mcp", async (req, res) => {
  console.error("\n========== POST /mcp ==========");

  try {
    console.error(
      JSON.stringify(req.body, null, 2)
    );
  } catch {
    console.error(
      "Unable to stringify request body"
    );
  }

  console.error(
    "MCP Method:",
    req.body?.method
  );

  const server = getServer();

  console.error("SERVER CREATED");

  try {
    const transport =
      new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

    await server.connect(transport);

    await transport.handleRequest(
      req,
      res,
      req.body
    );

    res.on("close", () => {
      console.error(
        "MCP Request Closed"
      );

      transport.close();
      server.close();
    });
  } catch (error) {
    console.error(
      "\n========== MCP ERROR =========="
    );
    console.error(error);

    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message:
            "Internal server error",
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
  console.error(
    "RailInfo Streamable MCP listening on port 3000"
  );
});