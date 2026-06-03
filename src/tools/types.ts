import { z } from "zod";

export interface McpTool<T extends z.ZodRawShape> {
  name: string;
  title: string;
  description: string;
  inputSchema: T;
  execute: (
    args: z.infer<z.ZodObject<T>>,
    options?: { formatMarkdown?: boolean }
  ) => Promise<{
    content: Array<{ type: "text"; text: string }>;
  }>;
}
