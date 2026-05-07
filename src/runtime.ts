import { BrvBridge, type BrvLogger } from "@byterover/brv-bridge";
import { maxCuratedTurnCacheSize } from "./config.js";
import type { ByteroverConfig } from "./config-loader.js";
import { LruCache } from "./lru-cache.js";
import type { LogFunction } from "./notifications.js";

export type BridgeOverride = {
  cwd?: string;
  searchTimeoutMs?: number;
  recallTimeoutMs?: number;
  persistTimeoutMs?: number;
};

export type RuntimeState = {
  config: ByteroverConfig;
  bridge: BrvBridge;
  brvCwd: string;
  curatedTurns: LruCache<string, string>;
  inFlightCurations: Map<string, { key: string; promise: Promise<void> }>;
};

export const createBridgeFactory = (
  config: ByteroverConfig,
  defaultCwd: string,
  log: LogFunction,
) => {
  const brvLogger: BrvLogger = {
    debug: (message) => log("debug", message),
    info: (message) => log("info", message),
    warn: (message) => log("warn", message),
    error: (message) => log("error", message),
  };

  return (override?: BridgeOverride) =>
    new BrvBridge({
      brvPath: config.brvPath,
      searchTimeoutMs: override?.searchTimeoutMs ?? config.searchTimeoutMs,
      recallTimeoutMs: override?.recallTimeoutMs ?? config.recallTimeoutMs,
      persistTimeoutMs: override?.persistTimeoutMs ?? config.persistTimeoutMs,
      cwd: override?.cwd ?? defaultCwd,
      logger: brvLogger,
    });
};

export const createRuntimeState = ({
  config,
  bridge,
  brvCwd,
}: {
  config: ByteroverConfig;
  bridge: BrvBridge;
  brvCwd: string;
}): RuntimeState => ({
  config,
  bridge,
  brvCwd,
  curatedTurns: new LruCache<string, string>(maxCuratedTurnCacheSize),
  inFlightCurations: new Map<string, { key: string; promise: Promise<void> }>(),
});
