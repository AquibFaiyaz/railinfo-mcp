import { z } from "zod";
import { getTrainRouteMap } from "../services/train.service.js";
import { TRAIN_ROUTE_MAP_PROMPTS } from "../constants/prompts.js";
import { McpTool } from "./types.js";

function formatRouteMapSummary(result: any): string {
  if (!result.found) {
    return `Train ${result.trainNo} — ${result.message ?? "Not found."}`;
  }

  const lines = [
    `🗺️ **Route Map for ${result.trainName} (${result.trainNo})**`,
    `Type: ${result.trainSubType || "N/A"}`,
    `Route: ${result.source} → ${result.destination}`,
    `Start Date: ${result.startDate}`,
  ];

  if (result.currentLocation) {
    let locLabel = result.currentLocation;
    if (result.route && result.route.length > 0) {
      const match = result.route.find(
        (s: any) => s.stationCode.toUpperCase() === result.currentLocation.toUpperCase()
      );
      if (match) {
        locLabel = `${match.stationName} (${match.stationCode})`;
      }
    }
    lines.push(`Current Location: ${locLabel}${result.currentDelay ? ` (Delay: ${result.currentDelay})` : ""}`);
  }

  if (result.route && result.route.length > 0) {
    lines.push("");
    lines.push(`📋 **Stops and Coordinates (${result.route.length} stops)**`);
    lines.push(`| # | Station | Dist | Sch. Arr | Sch. Dep | Latitude | Longitude | Map Link |`);
    lines.push(`| :--- | :--- | ---: | :--- | :--- | :--- | :--- | :--- |`);

    for (const stop of result.route) {
      const latVal = stop.latitude !== null ? stop.latitude.toFixed(6) : "—";
      const lonVal = stop.longitude !== null ? stop.longitude.toFixed(6) : "—";
      const mapLink = stop.latitude !== null && stop.longitude !== null
        ? `[📍 View Map](https://www.google.com/maps/search/?api=1&query=${stop.latitude},${stop.longitude})`
        : "—";

      lines.push(
        `| ${stop.sr} | ${stop.stationName} (${stop.stationCode}) | ${stop.distance} km | ${stop.scheduledArrival} | ${stop.scheduledDeparture} | ${latVal} | ${lonVal} | ${mapLink} |`
      );
    }
  }

  if (result.availableDates && result.availableDates.length > 1) {
    lines.push(
      `\nNote: Multiple running instances found (Started on: ${result.availableDates.join(", ")}). Specify 'startDate' to view another instance.`
    );
  }

  return lines.join("\n");
}

export const getTrainRouteMapTool: McpTool<{
  trainNo: z.ZodString;
  startDate: z.ZodOptional<z.ZodString>;
}> = {
  name: "get_train_route_map",
  title: "Get Train Route Map",
  description: TRAIN_ROUTE_MAP_PROMPTS.TOOL_DESCRIPTION,
  inputSchema: {
    trainNo: z.string().describe(TRAIN_ROUTE_MAP_PROMPTS.PARAM_TRAIN_NO),
    startDate: z.string().optional().describe(TRAIN_ROUTE_MAP_PROMPTS.PARAM_START_DATE),
  },
  execute: async ({ trainNo, startDate }, options) => {
    const result = await getTrainRouteMap(trainNo, startDate);

    const content: Array<{ type: "text"; text: string }> = [];

    if (options?.formatMarkdown) {
      const summary = formatRouteMapSummary(result);
      content.push({
        type: "text",
        text: summary,
      });
    }

    content.push({
      type: "text",
      text: JSON.stringify(result, null, 2),
    });

    return { content };
  },
};
