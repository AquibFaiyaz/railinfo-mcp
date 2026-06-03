import { z } from "zod";
import { getLiveTrainStatus } from "../services/train.service.js";
import { LIVE_TRAIN_STATUS_PROMPTS } from "../constants/prompts.js";
import { McpTool } from "./types.js";

function formatLiveTrainStatusSummary(status: any): string {
  if (!status.runningToday) {
    return `Train ${status.trainNo} is not found in live feed. ${status.message ?? ""}`;
  }

  const lines = [
    `Train: ${status.trainName} (${status.trainNo})`,
    `Start Date: ${status.startDate}`,
    `Current location: ${status.currentLocation} (${status.stationCode})`,
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

  return lines.filter(Boolean).join("\n");
}

export const getLiveTrainStatusTool: McpTool<{
  trainNo: z.ZodString;
  startDate: z.ZodOptional<z.ZodString>;
  targetStationCode: z.ZodOptional<z.ZodString>;
}> = {
  name: "get_live_train_status",
  title: "Get Live Train Status",
  description: LIVE_TRAIN_STATUS_PROMPTS.TOOL_DESCRIPTION,
  inputSchema: {
    trainNo: z.string().describe(LIVE_TRAIN_STATUS_PROMPTS.PARAM_TRAIN_NO),
    startDate: z.string().optional().describe(LIVE_TRAIN_STATUS_PROMPTS.PARAM_START_DATE),
    targetStationCode: z.string().optional().describe(LIVE_TRAIN_STATUS_PROMPTS.PARAM_TARGET_STATION),
  },
  execute: async ({ trainNo, startDate, targetStationCode }, options) => {
    const status = await getLiveTrainStatus(trainNo, startDate, targetStationCode);

    const content: Array<{ type: "text"; text: string }> = [];

    if (options?.formatMarkdown) {
      const summary = formatLiveTrainStatusSummary(status);
      content.push({
        type: "text",
        text: summary,
      });
    }

    content.push({
      type: "text",
      text: JSON.stringify(status, null, 2),
    });

    return { content };
  },
};
