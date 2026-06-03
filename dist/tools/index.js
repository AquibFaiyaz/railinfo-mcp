import { getLiveTrainStatusTool } from "./get_live_train_status.js";
import { getTrainsAtStationTool } from "./get_trains_at_station.js";
export const tools = [
    getLiveTrainStatusTool,
    getTrainsAtStationTool,
];
export function registerAllTools(server, options) {
    for (const tool of tools) {
        server.registerTool(tool.name, {
            title: tool.title,
            description: tool.description,
            inputSchema: tool.inputSchema,
        }, async (args) => {
            return tool.execute(args, options);
        });
    }
}
