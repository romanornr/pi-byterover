import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ByteroverConfig } from "./config-loader.js";
import type { extractPiSessionMessages } from "./messages.js";
import { turnKey } from "./messages.js";

export type RecallCacheEntry = {
  contextBlock: string;
  cachedAt: number;
};

const sessionKey = (ctx: ExtensionContext) => ctx.sessionManager.getSessionFile() ?? ctx.cwd;

export const recallCacheKey = ({
  ctx,
  query,
  sourceCwds,
  messages,
}: {
  ctx: ExtensionContext;
  query: string;
  sourceCwds: Array<string>;
  messages: ReturnType<typeof extractPiSessionMessages>;
}) => [sessionKey(ctx), ctx.cwd, turnKey(messages), sourceCwds.join("|"), query].join("\n---\n");

export const recallScopeKey = ({
  ctx,
  sourceCwds,
}: {
  ctx: ExtensionContext;
  sourceCwds: Array<string>;
}) => [sessionKey(ctx), ctx.cwd, sourceCwds.join("|")].join("\n---\n");

export const isFreshRecallCacheEntry = (
  entry: RecallCacheEntry | undefined,
  config: Pick<ByteroverConfig, "recallCacheTtlMs">,
  now = Date.now(),
) => entry !== undefined && now - entry.cachedAt <= config.recallCacheTtlMs;
