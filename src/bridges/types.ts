import type {
  PersistOptions,
  PersistResult,
  RecallOptions,
  RecallResult,
  SearchOptions,
  SearchResult,
} from "@byterover/brv-bridge";

/**
 * Minimal transport contract used by the Pi extension.
 *
 * Keep lifecycle/memory code typed against this shape instead of the concrete
 * `@byterover/brv-bridge` class so a future persistent transport can be swapped
 * in without changing recall, search, persistence, or manual-tool policy.
 */
export type ByteRoverBridgeLike = {
  ready(): Promise<boolean>;
  recall(query: string, options?: RecallOptions): Promise<RecallResult>;
  search(query: string, options?: SearchOptions): Promise<SearchResult>;
  persist(context: string, options?: PersistOptions): Promise<PersistResult>;
  shutdown?(): Promise<void>;
};

/** Per-bridge overrides used for scoped memories and per-call manual timeouts. */
export type BridgeOverride = {
  cwd?: string;
  searchTimeoutMs?: number;
  recallTimeoutMs?: number;
  persistTimeoutMs?: number;
};

/** Builds a bridge instance with shared extension config plus optional overrides. */
export type ByteRoverBridgeFactory = (override?: BridgeOverride) => ByteRoverBridgeLike;
