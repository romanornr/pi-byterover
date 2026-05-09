import type { BrvLogger } from "@byterover/brv-bridge";
import { CliByteRoverBridge } from "./bridges/cli-bridge.js";
import type {
  BridgeOverride,
  ByteRoverBridgeFactory,
  ByteRoverBridgeLike,
} from "./bridges/types.js";
import { maxCuratedTurnCacheSize } from "./config.js";
import type { ByteroverConfig } from "./config-loader.js";
import { LruCache } from "./lru-cache.js";
import type { MemorySource } from "./memory-sources.js";
import type { LogFunction } from "./notifications.js";
import type { RecallCacheEntry } from "./recall-cache.js";

export type RuntimeState = {
  config: ByteroverConfig;
  bridge: ByteRoverBridgeLike;
  autoRecallBridge: ByteRoverBridgeLike;
  autoPersistBridge: ByteRoverBridgeLike;
  brvCwd: string;
  readOnlyMemorySources: Array<MemorySource>;
  autoRecallMemorySources: Array<MemorySource>;
  recallCache: LruCache<string, RecallCacheEntry>;
  lastGoodRecallByScope: LruCache<string, RecallCacheEntry>;
  inFlightRecalls: Map<string, Promise<void>>;
  curatedTurns: LruCache<string, string>;
  inFlightCurations: Map<string, { key: string; promise: Promise<void> }>;
};

/**
 * Creates ByteRover bridges with shared config and optional per-call overrides.
 * The default cwd is the configured ByteRover workspace, not necessarily ctx.cwd.
 */
export const createBridgeFactory = (
  config: ByteroverConfig,
  defaultCwd: string,
  log: LogFunction,
): ByteRoverBridgeFactory => {
  const brvLogger: BrvLogger = {
    debug: (message) => log("debug", message),
    info: (message) => log("info", message),
    warn: (message) => log("warn", message),
    error: (message) => log("error", message),
  };

  return (override?: BridgeOverride) =>
    new CliByteRoverBridge({
      brvPath: config.brvPath,
      searchTimeoutMs: override?.searchTimeoutMs ?? config.searchTimeoutMs,
      recallTimeoutMs: override?.recallTimeoutMs ?? config.recallTimeoutMs,
      persistTimeoutMs: override?.persistTimeoutMs ?? config.persistTimeoutMs,
      cwd: override?.cwd ?? defaultCwd,
      logger: brvLogger,
    });
};

/**
 * Collects all mutable session-runtime state in one object so lifecycle handlers
 * can stay thin and avoid module-level caches beyond a single Pi session.
 */
export const createRuntimeState = ({
  config,
  bridge,
  autoRecallBridge,
  autoPersistBridge,
  brvCwd,
  readOnlyMemorySources = [],
  autoRecallMemorySources = [{ label: "Primary memory", cwd: brvCwd, bridge: autoRecallBridge }],
}: {
  config: ByteroverConfig;
  bridge: ByteRoverBridgeLike;
  autoRecallBridge: ByteRoverBridgeLike;
  autoPersistBridge: ByteRoverBridgeLike;
  brvCwd: string;
  readOnlyMemorySources?: Array<MemorySource>;
  autoRecallMemorySources?: Array<MemorySource>;
}): RuntimeState => ({
  config,
  bridge,
  autoRecallBridge,
  autoPersistBridge,
  brvCwd,
  readOnlyMemorySources,
  autoRecallMemorySources,
  recallCache: new LruCache<string, RecallCacheEntry>(config.maxRecallCacheSize),
  lastGoodRecallByScope: new LruCache<string, RecallCacheEntry>(config.maxRecallCacheSize),
  inFlightRecalls: new Map<string, Promise<void>>(),
  curatedTurns: new LruCache<string, string>(maxCuratedTurnCacheSize),
  inFlightCurations: new Map<string, { key: string; promise: Promise<void> }>(),
});
