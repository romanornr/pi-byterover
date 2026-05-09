import type {
  PersistOptions,
  PersistResult,
  RecallOptions,
  RecallResult,
  SearchOptions,
  SearchResult,
} from "@byterover/brv-bridge";

export type ByteRoverBridgeLike = {
  ready(): Promise<boolean>;
  recall(query: string, options?: RecallOptions): Promise<RecallResult>;
  search(query: string, options?: SearchOptions): Promise<SearchResult>;
  persist(context: string, options?: PersistOptions): Promise<PersistResult>;
  shutdown?(): Promise<void>;
};

export type BridgeOverride = {
  cwd?: string;
  searchTimeoutMs?: number;
  recallTimeoutMs?: number;
  persistTimeoutMs?: number;
};

export type ByteRoverBridgeFactory = (override?: BridgeOverride) => ByteRoverBridgeLike;
