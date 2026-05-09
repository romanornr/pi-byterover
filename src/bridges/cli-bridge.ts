import { BrvBridge, type BrvBridgeConfig } from "@byterover/brv-bridge";
import type { ByteRoverBridgeLike } from "./types.js";

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
