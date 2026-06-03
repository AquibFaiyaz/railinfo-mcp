import { z } from "zod";
import { getTrainsApproachingStation } from "../services/station.service.js";
import { TRAINS_APPROACHING_STATION_PROMPTS } from "../constants/prompts.js";
import { McpTool } from "./types.js";

function formatApproachingTrainsSummary(results: any[], stationCode: string, radiusKm: number): string {
  if (results.length === 0) {
    return `No active trains found physically approaching station **${stationCode}** within a **${radiusKm} km** radius.`;
  }

  const targetStationLabel = `${results[0].stationName} (${results[0].stationCode})`;
  
  const lines = [
    `🚆 **Live Trains Approaching ${targetStationLabel} (within ${radiusKm} km)**`,
    "",
    `| Train | Physical Dist | Scheduled Arr | Expected Arr | Delay | Platform | Status / Last Spotted |`,
    `| :--- | :--- | ---: | :--- | :--- | :--- | :--- |`,
  ];

  for (const train of results) {
    let status = "⏳ Approaching";
    if (train.hasArrived) {
      status = "📍 Arrived at Station";
    }

    const delay = train.delayArrival !== "On Time" ? train.delayArrival : "On Time";
    const distStr = `${train.physicalDistance.toFixed(1)} km`;

    lines.push(
      `| ${train.trainName} (${train.trainNo}) | ${distStr} | ${train.sta} | ${train.eta} | ${delay} | ${train.platform} | ${status} (Spotted at: ${train.currentLocation}) |`
    );
  }

  return lines.join("\n");
}

export const getTrainsApproachingStationTool: McpTool<{
  stationCode: z.ZodString;
  radiusKm: z.ZodOptional<z.ZodNumber>;
}> = {
  name: "get_trains_approaching_station",
  title: "Get Trains Approaching Station",
  description: TRAINS_APPROACHING_STATION_PROMPTS.TOOL_DESCRIPTION,
  inputSchema: {
    stationCode: z.string().describe(TRAINS_APPROACHING_STATION_PROMPTS.PARAM_STATION_CODE),
    radiusKm: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .describe(TRAINS_APPROACHING_STATION_PROMPTS.PARAM_RADIUS_KM),
  },
  execute: async ({ stationCode, radiusKm }, options) => {
    const radius = radiusKm ?? 50;
    const results = await getTrainsApproachingStation(stationCode, radius);

    const content: Array<{ type: "text"; text: string }> = [];

    if (options?.formatMarkdown) {
      const summary = formatApproachingTrainsSummary(results, stationCode, radius);
      content.push({
        type: "text",
        text: summary,
      });
    }

    content.push({
      type: "text",
      text: JSON.stringify(results, null, 2),
    });

    return { content };
  },
};
