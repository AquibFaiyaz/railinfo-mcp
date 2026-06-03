import { z } from "zod";
import { getTrainsAtStation } from "../services/train.service.js";
import { TRAINS_AT_STATION_PROMPTS } from "../constants/prompts.js";
function formatTrainsAtStationSummary(stationCode, hours, trains) {
    if (!Array.isArray(trains) || trains.length === 0) {
        return `No upcoming trains found arriving or departing at station ${stationCode.toUpperCase()} in the next ${hours} hours.`;
    }
    const lines = [
        `### 🚉 Upcoming Trains at ${stationCode.toUpperCase()} (Next ${hours} Hours)\n`,
        `| Train | Schedule (STA/STD) | Live Status (ETA/ETD) | Delay (Arr/Dep) | PF | Current Status / Location |`,
        `| :--- | :--- | :--- | :--- | :--- | :--- |`,
    ];
    for (const t of trains) {
        const trainInfo = `**${t.trainNo}** ${t.trainName || ""}`;
        const schedule = `${t.sta} / ${t.std}`;
        const isArrDelayed = t.delayArrival !== "On Time" &&
            t.delayArrival !== "00:00" &&
            t.delayArrival !== "";
        const isDepDelayed = t.delayDeparture !== "On Time" &&
            t.delayDeparture !== "00:00" &&
            t.delayDeparture !== "";
        const etaFormatted = isArrDelayed ? `**${t.eta}**` : t.eta;
        const etdFormatted = isDepDelayed ? `**${t.etd}**` : t.etd;
        const liveStatus = `${etaFormatted} / ${etdFormatted}`;
        const delay = `${t.delayArrival || "On Time"} / ${t.delayDeparture || "On Time"}`;
        const pf = t.platform || "N/A";
        let current = t.currentLocation || "Spotted";
        if (t.hasDeparted) {
            current = `Departed ${stationCode.toUpperCase()}`;
        }
        else if (t.hasArrived) {
            current = `Arrived at ${stationCode.toUpperCase()}`;
        }
        lines.push(`| ${trainInfo} | ${schedule} | ${liveStatus} | ${delay} | ${pf} | ${current} |`);
    }
    return lines.join("\n");
}
export const getTrainsAtStationTool = {
    name: "get_trains_at_station",
    title: "Get Trains at Station (Live Station)",
    description: TRAINS_AT_STATION_PROMPTS.TOOL_DESCRIPTION,
    inputSchema: {
        stationCode: z.string().describe(TRAINS_AT_STATION_PROMPTS.PARAM_STATION_CODE),
        hours: z
            .number()
            .optional()
            .default(2)
            .describe(TRAINS_AT_STATION_PROMPTS.PARAM_HOURS),
    },
    execute: async ({ stationCode, hours }, options) => {
        const trains = await getTrainsAtStation(stationCode, hours);
        const content = [];
        if (options?.formatMarkdown) {
            const summary = formatTrainsAtStationSummary(stationCode, hours, trains);
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
