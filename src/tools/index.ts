import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getLiveTrainStatusTool } from "./get_live_train_status.js";
import { getTrainsAtStationTool } from "./get_trains_at_station.js";
import { getTrainCrossingsAndRadarTool } from "./get_train_crossings_and_radar.js";
import { getTrainsBetweenStationsTool } from "./get_trains_between_stations.js";
import { getTrainTimetableTool } from "./get_train_timetable.js";
import { McpTool } from "./types.js";

export const tools: McpTool<any>[] = [
  getLiveTrainStatusTool,
  getTrainsAtStationTool,
  getTrainCrossingsAndRadarTool,
  getTrainsBetweenStationsTool,
  getTrainTimetableTool,
];


export function registerAllTools(
  server: McpServer,
  options?: { formatMarkdown?: boolean }
) {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      async (args: any) => {
        return tool.execute(args, options);
      }
    );
  }
}
