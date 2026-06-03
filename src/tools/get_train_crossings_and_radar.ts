import { z } from "zod";
import { getTrainCrossingsAndRadar } from "../services/train.service.js";
import { CROSSINGS_AND_RADAR_PROMPTS } from "../constants/prompts.js";
import { McpTool } from "./types.js";

function formatTrainCrossingsSummary(report: any): string {
  if (!report.runningToday) {
    return `Train ${report.trainNo} is not found in live feed. ${report.message ?? ""}`;
  }

  const lines = [
    `### 🛤️ Train Meetings & Radar: ${report.trainName || ""} (${report.trainNo})`,
    `- **Start Date**: ${report.startDate}`,
  ];

  if (report.currentLocation) {
    lines.push(`- **Current Location**: ${report.currentLocation} ${report.lastUpdated ? `(last spotted at ${report.lastUpdated})` : ""}`);
  }

  lines.push("");

  if (!Array.isArray(report.stops) || report.stops.length === 0) {
    lines.push("No active crossing, ahead, or behind train meetings found for this run.");
    return lines.join("\n");
  }

  lines.push("| Station | ETA / ETD | Event | Nearby Train | Block / Section |");
  lines.push("| :--- | :--- | :--- | :--- | :--- |");

  for (const stop of report.stops) {
    const stationStr = `**${stop.stationName}** (${stop.stationCode})`;
    const timeStr = `${stop.actArr || stop.wttArr || "—"} / ${stop.actDep || stop.wttDep || "—"}`;

    const addEventLines = (list: any[], typeLabel: string) => {
      if (!Array.isArray(list)) return;
      for (const t of list) {
        const trainInfo = `**${t.trainNo}** ${t.trainName || ""}`;
        const sectionInfo = t.blockSection ? `${t.blockSection} (${t.section || ""})` : (t.section || "—");
        lines.push(`| ${stationStr} | ${timeStr} | ${typeLabel} | ${trainInfo} | ${sectionInfo} |`);
      }
    };

    addEventLines(stop.crossings, "🔀 Crossing");
    addEventLines(stop.ahead, "🛑 Ahead");
    addEventLines(stop.behind, "⏮️ Behind");
  }

  if (report.availableDates && report.availableDates.length > 1) {
    lines.push(
      `\n*Note: Multiple running instances found for this train (Started on: ${report.availableDates.join(", ")}). To view another instance, specify the 'startDate' parameter.*`
    );
  }

  return lines.join("\n");
}

export const getTrainCrossingsAndRadarTool: McpTool<{
  trainNo: z.ZodString;
  startDate: z.ZodOptional<z.ZodString>;
  stationCode: z.ZodOptional<z.ZodString>;
}> = {
  name: "get_train_crossings_and_radar",
  title: "Get Train Crossings and Radar",
  description: CROSSINGS_AND_RADAR_PROMPTS.TOOL_DESCRIPTION,
  inputSchema: {
    trainNo: z.string().describe(CROSSINGS_AND_RADAR_PROMPTS.PARAM_TRAIN_NO),
    startDate: z.string().optional().describe(CROSSINGS_AND_RADAR_PROMPTS.PARAM_START_DATE),
    stationCode: z.string().optional().describe(CROSSINGS_AND_RADAR_PROMPTS.PARAM_STATION_CODE),
  },
  execute: async ({ trainNo, startDate, stationCode }, options) => {
    const report = await getTrainCrossingsAndRadar(trainNo, startDate, stationCode);

    const content: Array<{ type: "text"; text: string }> = [];

    if (options?.formatMarkdown) {
      const summary = formatTrainCrossingsSummary(report);
      content.push({
        type: "text",
        text: summary,
      });
    }

    content.push({
      type: "text",
      text: JSON.stringify(report, null, 2),
    });

    return { content };
  },
};
