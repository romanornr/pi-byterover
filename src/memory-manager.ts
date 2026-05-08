import type {
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { ByteroverConfig } from "./config-loader.js";
import { buildManualToolGuidance } from "./manual-guidance.js";
import { formatMemorySourceContent } from "./memory-sources.js";
import {
  appendSystemPromptBlock,
  buildRecallQuery,
  formatRecallContext,
  messagesWithCurrentPrompt,
  prepareRecallContent,
} from "./recall-context.js";
import { extractPiSessionMessages, formatMessages, selectMessagesForRecall } from "./messages.js";
import type { LogFunction, NotifyFunction } from "./notifications.js";
import { errorMessage } from "./notifications.js";
import { evaluateRecallQuality, shouldInjectRecallQuality } from "./recall-quality.js";
import { stripEchoedRecallQuery } from "./recall.js";
import { isFreshRecallCacheEntry, recallCacheKey, recallScopeKey } from "./recall-cache.js";
import type { RuntimeState } from "./runtime.js";

const genericFollowUpPrompts = new Set([
  "what is next?",
  "what next?",
  "next?",
  "continue",
  "go on",
  "ok",
  "okay",
  "yes",
]);

export const shouldAttemptAutoRecall = ({
  config,
  latestPrompt,
  formattedMessages,
}: {
  config: Pick<ByteroverConfig, "minAutoRecallPromptChars">;
  latestPrompt: string;
  formattedMessages: string;
}) => {
  if (!formattedMessages.trim()) return false;
  const trimmedPrompt = latestPrompt.trim();
  if (trimmedPrompt.length < config.minAutoRecallPromptChars) return false;
  if (genericFollowUpPrompts.has(trimmedPrompt.toLowerCase())) return false;
  return true;
};

const runRecallPrefetch = async ({
  ctx,
  state,
  query,
  cacheKey,
  scopeKey,
  sources,
  includeSourceLabels,
  formattedMessages,
  latestPrompt,
  notify,
  log,
}: {
  ctx: ExtensionContext;
  state: RuntimeState;
  query: string;
  cacheKey: string;
  scopeKey: string;
  sources: RuntimeState["autoRecallMemorySources"];
  includeSourceLabels: boolean;
  formattedMessages: string;
  latestPrompt: string;
  notify: NotifyFunction;
  log: LogFunction;
}) => {
  const startedAt = Date.now();
  try {
    const isReady = await state.autoRecallBridge.ready();
    if (!isReady) {
      notify(ctx, "warning", "ByteRover bridge not ready, skipping recall", state.config);
      log("warn", "ByteRover bridge not ready, skipping recall");
      state.recallCache.set(cacheKey, { contextBlock: "", cachedAt: Date.now() });
      return;
    }

    const recalledSources = await Promise.all(
      sources.map(async (source) => {
        const brvResult = await source.bridge.recall(query, { cwd: source.cwd });
        const content = prepareRecallContent(
          stripEchoedRecallQuery(brvResult.content, query),
          state.config.maxRecallContextChars,
        );
        if (!content) return "";
        return formatMemorySourceContent(source, content, includeSourceLabels);
      }),
    );
    const content = prepareRecallContent(
      recalledSources.filter((source) => source.trim()).join("\n\n"),
      state.config.maxRecallContextChars,
    );
    if (!content) {
      state.recallCache.set(cacheKey, { contextBlock: "", cachedAt: Date.now() });
      return;
    }
    const quality = evaluateRecallQuality({
      latestPrompt,
      projectCwd: ctx.cwd,
      formattedMessages,
      content,
    });
    if (!shouldInjectRecallQuality(quality)) {
      log("debug", `ByteRover recall suppressed: ${quality.reason}`);
      state.recallCache.set(cacheKey, { contextBlock: "", cachedAt: Date.now() });
      return;
    }

    const entry = {
      contextBlock: formatRecallContext(state.config.contextTagName, content, quality),
      cachedAt: Date.now(),
    };
    state.inFlightRecalls.delete(cacheKey);
    state.recallCache.set(cacheKey, entry);
    state.lastGoodRecallByScope.set(scopeKey, entry);
  } catch (error) {
    notify(ctx, "error", "Failed to recall context from ByteRover", state.config);
    log("error", `ByteRover recall failed: ${errorMessage(error)}`);
    state.recallCache.set(cacheKey, { contextBlock: "", cachedAt: Date.now() });
  } finally {
    log("debug", `ByteRover recall prefetch completed in ${Date.now() - startedAt}ms`);
  }
};

export const queueRecallPrefetch = (params: Parameters<typeof runRecallPrefetch>[0]) => {
  const { state, cacheKey, log } = params;
  if (isFreshRecallCacheEntry(state.recallCache.get(cacheKey), state.config)) return;
  if (state.inFlightRecalls.has(cacheKey)) return;
  if (state.inFlightRecalls.size >= state.config.maxInFlightRecalls) {
    log("debug", "Skipping ByteRover recall prefetch because the in-flight limit is reached");
    return;
  }

  const promise = runRecallPrefetch(params).finally(() => {
    state.inFlightRecalls.delete(cacheKey);
  });
  state.inFlightRecalls.set(cacheKey, promise);
};

/**
 * before_agent_start handler: inject cached ByteRover recall if available and
 * warm the cache in the background. The default hot Pi hook must not wait for brv.
 */
export const recallBeforeAgentStart = async ({
  event,
  ctx,
  state,
  notify,
  log,
}: {
  event: BeforeAgentStartEvent;
  ctx: ExtensionContext;
  state: RuntimeState | undefined;
  notify: NotifyFunction;
  log: LogFunction;
}): Promise<BeforeAgentStartEventResult> => {
  const startedAt = Date.now();
  try {
    if (state === undefined) return { systemPrompt: event.systemPrompt };

    const { config, autoRecallMemorySources } = state;
    let systemPrompt = event.systemPrompt;

    if (config.manualTools) {
      systemPrompt = appendSystemPromptBlock(systemPrompt, buildManualToolGuidance(config));
    }

    if (!config.autoRecall) return { systemPrompt };

    const messagesForRecall = selectMessagesForRecall(
      messagesWithCurrentPrompt(
        extractPiSessionMessages(ctx.sessionManager.getBranch()),
        event.prompt,
      ),
      config,
    );
    const formattedMessages = formatMessages(messagesForRecall);
    if (!shouldAttemptAutoRecall({ config, latestPrompt: event.prompt, formattedMessages })) {
      return { systemPrompt };
    }

    const query = buildRecallQuery({
      config,
      projectCwd: ctx.cwd,
      latestPrompt: event.prompt,
      formattedMessages,
    });
    const sourceCwds = autoRecallMemorySources.map((source) => source.cwd);
    const includeSourceLabels = autoRecallMemorySources.length > 1;
    const cacheKey = recallCacheKey({
      ctx,
      query,
      sourceCwds,
      messages: messagesForRecall,
    });
    const scopeKey = recallScopeKey({ ctx, sourceCwds });

    const cached = state.recallCache.get(cacheKey);
    if (cached?.contextBlock && isFreshRecallCacheEntry(cached, config)) {
      return { systemPrompt: appendSystemPromptBlock(systemPrompt, cached.contextBlock) };
    }

    const prefetchParams = {
      ctx,
      state,
      query,
      cacheKey,
      scopeKey,
      sources: autoRecallMemorySources,
      includeSourceLabels,
      formattedMessages,
      latestPrompt: event.prompt,
      notify,
      log,
    };

    if (config.autoRecallMode === "blocking") {
      await runRecallPrefetch(prefetchParams);
      const refreshed = state.recallCache.get(cacheKey);
      if (refreshed?.contextBlock) {
        return { systemPrompt: appendSystemPromptBlock(systemPrompt, refreshed.contextBlock) };
      }
      return { systemPrompt };
    }

    queueRecallPrefetch(prefetchParams);

    if (config.autoRecallMode === "stale-while-revalidate") {
      const lastGoodRecall = state.lastGoodRecallByScope.get(scopeKey);
      if (lastGoodRecall?.contextBlock && isFreshRecallCacheEntry(lastGoodRecall, config)) {
        return {
          systemPrompt: appendSystemPromptBlock(systemPrompt, lastGoodRecall.contextBlock),
        };
      }
    }

    return { systemPrompt };
  } finally {
    log("debug", `ByteRover before_agent_start completed in ${Date.now() - startedAt}ms`);
  }
};
