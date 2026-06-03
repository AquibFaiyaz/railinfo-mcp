import { z } from "zod";
import { getTrainsBetweenStations } from "../services/station.service.js";
import { TRAINS_BETWEEN_STATIONS_PROMPTS } from "../constants/prompts.js";
import { McpTool } from "./types.js";

function formatTrainsBetweenStationsSummary(
  fromStation: string,
  toStation: string,
  hours: number,
  trains: any[]
): string {
  const fromUpper = fromStation.toUpperCase();
  const toUpper = toStation.toUpperCase();
  if (!Array.isArray(trains) || trains.length === 0) {
    return `No upcoming trains found running from **${fromUpper}** to **${toUpper}** in the next ${hours} hours.`;
  }

  const lines = [
    `### 🛤️ Live Trains: ${fromUpper} ➡️ ${toUpper} (Next ${hours} Hours)\n`,
    `| Train | Status at ${fromUpper} | Status at ${toUpper} | Delay | Current Location |`,
    `| :--- | :--- | :--- | :--- | :--- |`,
  ];

  for (const t of trains) {
    const trainStr = `**${t.trainNo}** ${t.trainName || ""}`;

    const f = t.fromStation;
    const tDepTime = f.etd !== f.std && f.etd !== "Destination" && f.etd !== "" ? `**${f.etd}**` : (f.etd || f.std || "—");
    const fPlatform = f.platform || "N/A";
    const fStatus = `Dep: ${tDepTime} (Sched: ${f.std || "—"}) [PF: ${fPlatform}]`;

    const dest = t.toStation;
    const tArrTime = dest.eta !== dest.sta && dest.eta !== "Source" && dest.eta !== "" ? `**${dest.eta}**` : (dest.eta || dest.sta || "—");
    const destPlatform = dest.platform || "N/A";
    const destStatus = `Arr: ${tArrTime} (Sched: ${dest.sta || "—"}) [PF: ${destPlatform}]`;

    const delayStr = `Dep: ${f.delayDeparture || "On Time"} / Arr: ${dest.delayArrival || "On Time"}`;
    const location = t.currentLocation || "Spotted";

    lines.push(`| ${trainStr} | ${fStatus} | ${destStatus} | ${delayStr} | ${location} |`);
  }

  return lines.join("\n");
}

export const getTrainsBetweenStationsTool: McpTool<{
  fromStationCode: z.ZodString;
  toStationCode: z.ZodString;
  hours: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}> = {
  name: "get_trains_between_stations",
  title: "Get Trains Between Stations",
  description: TRAINS_BETWEEN_STATIONS_PROMPTS.TOOL_DESCRIPTION,
  inputSchema: {
    fromStationCode: z.string().describe(TRAINS_BETWEEN_STATIONS_PROMPTS.PARAM_FROM_STATION_CODE),
    toStationCode: z.string().describe(TRAINS_BETWEEN_STATIONS_PROMPTS.PARAM_TO_STATION_CODE),
    hours: z
      .number()
      .optional()
      .default(4)
      .describe(TRAINS_BETWEEN_STATIONS_PROMPTS.PARAM_HOURS),
  },
  execute: async ({ fromStationCode, toStationCode, hours }, options) => {
    const trains = await getTrainsBetweenStations(fromStationCode, toStationCode, hours);

    const content: Array<{ type: "text"; text: string }> = [];

    if (options?.formatMarkdown) {
      const summary = formatTrainsBetweenStationsSummary(fromStationCode, toStationCode, hours, trains);
      content.push({
        type: "text",
        text: summary,
      });
    }

    content.push({
      type: "text",
      text: JSON.stringify(trains, null, 2),
    });

    return { content };
  },
};
