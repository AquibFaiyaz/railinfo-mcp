import axios from "axios";
import dotenv from "dotenv";
import { logger } from "./logger.js";

dotenv.config();

const baseURL = process.env.RAIL_API_BASE_URL;

if (!baseURL) {
  throw new Error("RAIL_API_BASE_URL environment variable is not defined");
}

export const railApi = axios.create({
  baseURL,
  timeout: 50000,
  headers: {
    "x-requested-with": "XMLHttpRequest",
    referer: `${baseURL}/`,
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36",
  },
});

// Outgoing Request Interceptor
railApi.interceptors.request.use(
  (config) => {
    // Save start time to compute query latency on response
    (config as any).metadata = { startTime: Date.now() };
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Outgoing Response Interceptor
railApi.interceptors.response.use(
  (response) => {
    const startTime = (response.config as any).metadata?.startTime;
    const durationMs = startTime ? Date.now() - startTime : 0;

    logger.info({
      message: `Outgoing API response: ${response.config.method?.toUpperCase()} ${response.config.url}`,
      type: "transaction",
      payload: {
        direction: "outgoing",
        request: {
          method: response.config.method?.toUpperCase(),
          url: response.config.url,
          params: response.config.params || null,
          body: response.config.data ? JSON.parse(response.config.data) : null,
        },
        response: {
          status: response.status,
          body: response.data || null,
        },
        durationMs,
      },
    });

    return response;
  },
  (error) => {
    const config = error.config;
    const startTime = config?.metadata?.startTime;
    const durationMs = startTime ? Date.now() - startTime : 0;

    logger.error({
      message: `Outgoing API error: ${config?.method?.toUpperCase()} ${config?.url} - ${error.message}`,
      type: "transaction",
      payload: {
        direction: "outgoing",
        request: {
          method: config?.method?.toUpperCase(),
          url: config?.url,
          params: config?.params || null,
          body: config?.data ? JSON.parse(config.data) : null,
        },
        response: {
          status: error.response?.status || 500,
          error: error.message,
          body: error.response?.data || null,
        },
        durationMs,
      },
    });

    return Promise.reject(error);
  }
);