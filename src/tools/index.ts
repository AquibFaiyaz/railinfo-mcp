import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getLiveTrainStatusTool } from "./get_live_train_status.js";
import { getTrainsAtStationTool } from "./get_trains_at_station.js";
import { McpTool } from "./types.js";

export const tools: McpTool<any>[] = [
  getLiveTrainStatusTool,
  getTrainsAtStationTool,
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
