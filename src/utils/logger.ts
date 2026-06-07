import winston from "winston";
import Transport from "winston-transport";
import { AsyncLocalStorage } from "node:async_hooks";
import dotenv from "dotenv";

dotenv.config();

// Thread-local style storage for traceId propagation across asynchronous calls
export const traceStore = new AsyncLocalStorage<{ traceId: string }>();

const backendUrl = process.env.LOGGER_BACKEND_URL;

class CentralLoggerTransport extends Transport {
  constructor(opts?: any) {
    super(opts);
  }

  log(info: any, callback: () => void) {
    setImmediate(async () => {
      if (!backendUrl) {
        return;
      }
      try {
        const store = traceStore.getStore();
        const traceId = store?.traceId || info.traceId || null;

        // Map winston info properties to our generic logger ingestion schema
        const ingestPayload = {
          appId: "railinfo-mcp",
          traceId,
          type: info.type || "log",
          level: info.level || "info",
          message: info.message || null,
          timestamp: info.timestamp || new Date().toISOString(),
          payload: info.payload || null,
        };

        // Fire-and-forget async fetch
        fetch(`${backendUrl}/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ingestPayload),
        }).catch(() => {
          // Silently absorb failures so client remains completely decoupled and stable
        });
      } catch (err) {
        // Silently absorb log delivery errors
      }
    });

    callback();
  }
}

export const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, type }) => {
          const store = traceStore.getStore();
          const traceId = store?.traceId;
          const traceStr = traceId ? ` [trace:${traceId.slice(0, 8)}]` : "";
          const typeStr = type ? ` [${type}]` : "";
          return `[${timestamp}] ${level}:${traceStr}${typeStr} ${message}`;
        })
      ),
    }),
  ],
});

// Append centralized HTTP transport if configuration is present
if (backendUrl) {
  logger.add(new CentralLoggerTransport());
}
