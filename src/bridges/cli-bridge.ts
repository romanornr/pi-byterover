import { BrvBridge, type BrvBridgeConfig } from "@byterover/brv-bridge";
import type { ByteRoverBridgeLike } from "./types.js";

/**
 * Adapter for the current public ByteRover bridge package.
 *
 * This deliberately preserves today's CLI-backed behavior while hiding the
 * concrete `BrvBridge` class from extension policy code. The next transport
 * experiment can implement `ByteRoverBridgeLike` without touching callers.
 */
export class CliByteRoverBridge implements ByteRoverBridgeLike {
  private readonly bridge: BrvBridge;

  constructor(config: BrvBridgeConfig) {
    this.bridge = new BrvBridge(config);
  }

  ready() {
    return this.bridge.ready();
  }

  recall(...args: Parameters<ByteRoverBridgeLike["recall"]>) {
    return this.bridge.recall(...args);
  }

  search(...args: Parameters<ByteRoverBridgeLike["search"]>) {
    return this.bridge.search(...args);
  }

  persist(...args: Parameters<ByteRoverBridgeLike["persist"]>) {
    return this.bridge.persist(...args);
  }

  shutdown() {
    return this.bridge.shutdown();
  }
}
