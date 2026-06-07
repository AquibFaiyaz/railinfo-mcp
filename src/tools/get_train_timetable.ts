import { z } from "zod";
import { getTrainTimetable } from "../services/train.service.js";
import { TRAIN_TIMETABLE_PROMPTS } from "../constants/prompts.js";
import { McpTool } from "./types.js";

function formatTimetableSummary(result: any): string {
  if (!result.found) {
    return `Train ${result.trainNo} — ${result.message ?? "Not found."}`;
  }

  const lines = [
    `🚆 **${result.trainName} (${result.trainNo})**`,
    `Type: ${result.trainSubType || "N/A"}`,
    `Route: ${result.source} → ${result.destination}`,
    `Start Date: ${result.startDate}`,
  ];

  if (result.currentLocation) {
    let locLabel = result.currentLocation;
    if (result.timetable && result.timetable.length > 0) {
      const match = result.timetable.find(
        (s: any) => s.stationCode.toUpperCase() === result.currentLocation.toUpperCase()
      );
      if (match) {
        locLabel = `${match.stationName} (${match.stationCode})`;
      }
    }
    lines.push(`Current Location: ${locLabel}${result.currentDelay ? ` (Delay: ${result.currentDelay})` : ""}`);
  }

  if (result.timetable && result.timetable.length > 0) {
    lines.push("");
    lines.push(`📋 **Full Timetable (${result.timetable.length} stops)**`);
    lines.push(`| # | Station | Dist | Sch. Arr | Sch. Dep | Exp. Arr | Exp. Dep | Delay | PF | Status |`);
    lines.push(`| :--- | :--- | ---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |`);

    for (const stop of result.timetable) {
      let statusIcon = "⏳ Upcoming";
      if (stop.arrivalCancelled || stop.departureCancelled) {
        statusIcon = "❌ Cancelled";
      } else if (stop.hasDeparted) {
        statusIcon = "✅ Departed";
      } else if (stop.hasArrived) {
        statusIcon = "📍 At Station";
      }

      const delay = stop.delayArrival !== "On Time" ? stop.delayArrival : stop.delayDeparture !== "On Time" ? stop.delayDeparture : "On Time";
      const reversal = stop.rakeReversal ? " 🔄" : "";

      lines.push(
        `| ${stop.sr} | ${stop.stationName} (${stop.stationCode})${reversal} | ${stop.distance} km | ${stop.scheduledArrival} | ${stop.scheduledDeparture} | ${stop.expectedArrival} | ${stop.expectedDeparture} | ${delay} | ${stop.platform} | ${statusIcon} |`
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

export const getTrainTimetableTool: McpTool<{
  trainNo: z.ZodString;
  startDate: z.ZodOptional<z.ZodString>;
}> = {
  name: "get_train_timetable",
  title: "Get Train Timetable",
  description: TRAIN_TIMETABLE_PROMPTS.TOOL_DESCRIPTION,
  inputSchema: {
    trainNo: z.string().describe(TRAIN_TIMETABLE_PROMPTS.PARAM_TRAIN_NO),
    startDate: z.string().optional().describe(TRAIN_TIMETABLE_PROMPTS.PARAM_START_DATE),
  },
  execute: async ({ trainNo, startDate }, options) => {
    const result = await getTrainTimetable(trainNo, startDate);

    const content: Array<{ type: "text"; text: string }> = [];

    if (options?.formatMarkdown) {
      const summary = formatTimetableSummary(result);
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
