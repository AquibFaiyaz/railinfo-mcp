import { z } from "zod";
import { getLiveTrainStatus } from "../services/train.service.js";
import { GET_TRAIN_SPEED_PROMPTS } from "../constants/prompts.js";
import { McpTool } from "./types.js";

function formatTrainSpeedSummary(status: any): string {
  if (!status.runningToday) {
    return `Train ${status.trainNo} is not currently running or active. ${status.message ?? ""}`;
  }

  const speed = status.locoSpeed ?? 0;
  const source = status.locationSource || "NTES";
  const sourceLabel = source.toUpperCase() === "GPS" 
    ? "📡 GPS (RTIS Satellite - Real-time)" 
    : "🚉 NTES (Station-based manual logs)";
  
  const freshness = status.gpsDataAge && status.gpsDataAge.toLowerCase() !== "null"
    ? `Updated **${status.gpsDataAge}**`
    : "Data age unavailable";

  const lines = [
    `### ⚡ Train Speed & GPS Tracking: ${status.trainName} (${status.trainNo})`,
    `- **Current Speed**: **${speed} km/h**`,
    `- **Tracking Source**: ${sourceLabel}`,
    `- **Last Position**: ${status.currentStation} (${status.stationCode})`,
    `- **Data Freshness**: ${freshness}`,
  ];

  if (status.locoAttached) {
    lines.push(
      `- **Locomotive Details**:`,
      `  - Loco Number: **${status.locoNo || "N/A"}**`,
      `  - Loco Attached: **Yes**`
    );
  } else {
    lines.push(`- **Locomotive Details**: No locomotive information currently attached.`);
  }

  if (status.lastSpottedAt) {
    lines.push(`- **Last Spotted At**: ${status.lastSpottedAt}`);
  }

  if (status.availableDates && status.availableDates.length > 1) {
    lines.push(
      `\n*Note: Multiple active instances found for this train (Started: ${status.availableDates.join(", ")}). Specify 'startDate' parameter to view speed for a different run.*`
    );
  }

  return lines.join("\n");
}

export const getTrainSpeedTool: McpTool<{
  trainNo: z.ZodString;
  startDate: z.ZodOptional<z.ZodString>;
}> = {
  name: "get_train_speed",
  title: "Get Train Speed and Tracking Source",
  description: GET_TRAIN_SPEED_PROMPTS.TOOL_DESCRIPTION,
  inputSchema: {
    trainNo: z.string().describe(GET_TRAIN_SPEED_PROMPTS.PARAM_TRAIN_NO),
    startDate: z.string().optional().describe(GET_TRAIN_SPEED_PROMPTS.PARAM_START_DATE),
  },
  execute: async ({ trainNo, startDate }, options) => {
    const status = await getLiveTrainStatus(trainNo, startDate);

    const content: Array<{ type: "text"; text: string }> = [];

    if (options?.formatMarkdown) {
      const summary = formatTrainSpeedSummary(status);
      content.push({
        type: "text",
        text: summary,
      });
    }

    // Expose raw status focused on speed fields, plus other core identifying attributes
    let speedDetails: any;
    if (status.runningToday) {
      speedDetails = {
        runningToday: true,
        trainNo: status.trainNo,
        trainName: status.trainName,
        startDate: status.startDate,
        currentLocation: status.currentLocation,
        locationSource: status.locationSource,
        locoAttached: status.locoAttached,
        locoNo: status.locoNo,
        locoSpeed: status.locoSpeed,
        gpsDataAge: status.gpsDataAge,
        lastSpottedAt: status.lastSpottedAt,
        availableDates: status.availableDates,
      };
    } else {
      speedDetails = {
        runningToday: false,
        trainNo: status.trainNo,
        message: status.message,
      };
    }

    content.push({
      type: "text",
      text: JSON.stringify(speedDetails, null, 2),
    });

    return { content };
  },
};
