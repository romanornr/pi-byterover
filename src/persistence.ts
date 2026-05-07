import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { formatCompactFlushContext } from "./compact-flush.js";
import {
  extractPiSessionMessages,
  formatMessages,
  selectMessagesInTurn,
  turnKey,
} from "./messages.js";
import type { LogFunction, NotifyFunction } from "./notifications.js";
import { errorMessage } from "./notifications.js";
import type { RuntimeState } from "./runtime.js";

const sessionKey = (ctx: ExtensionContext) => ctx.sessionManager.getSessionFile() ?? ctx.cwd;

export const persistCuratedMessages = async ({
  ctx,
  state,
  messages,
  keyPrefix,
  content,
  notify,
  log,
}: {
  ctx: ExtensionContext;
  state: RuntimeState | undefined;
  messages: ReturnType<typeof extractPiSessionMessages>;
  keyPrefix: string;
  content: string;
  notify: NotifyFunction;
  log: LogFunction;
}) => {
  if (state === undefined) return;

  const { bridge, config, brvCwd, curatedTurns, inFlightCurations } = state;
  if (!config.autoPersist || config.readOnly) return;
  if (messages.length === 0) return;

  const key = `${keyPrefix}:${turnKey(messages)}`;
  const dedupeKey = `${sessionKey(ctx)}:${keyPrefix}`;
  if (curatedTurns.get(dedupeKey) === key) {
    log("debug", `Skipping duplicate ByteRover curation for ${dedupeKey}`);
    return;
  }

  const inFlightCuration = inFlightCurations.get(dedupeKey);
  if (inFlightCuration?.key === key) {
    log("debug", `Skipping in-flight ByteRover curation for ${dedupeKey}`);
    await inFlightCuration.promise;
    return;
  }

  const persistCuration = async () => {
    try {
      const result = await bridge.persist(content, { cwd: brvCwd });
      if (result.status === "error") {
        notify(ctx, "error", "Failed to curate conversation turn with ByteRover", config);
        log("error", `ByteRover curation failed: ${result.message}`);
        return;
      }

      const currentInFlightCuration = inFlightCurations.get(dedupeKey);
      if (currentInFlightCuration?.key === key && currentInFlightCuration.promise === promise) {
        curatedTurns.set(dedupeKey, key);
      }
    } catch (error) {
      notify(ctx, "error", "Failed to curate conversation turn with ByteRover", config);
      log("error", `ByteRover curation failed: ${errorMessage(error)}`);
    }
  };

  const promise = persistCuration();
  inFlightCurations.set(dedupeKey, { key, promise });
  try {
    await promise;
  } finally {
    if (inFlightCurations.get(dedupeKey)?.promise === promise) {
      inFlightCurations.delete(dedupeKey);
    }
  }
};

export const curateTurn = async ({
  ctx,
  state,
  notify,
  log,
}: {
  ctx: ExtensionContext;
  state: RuntimeState | undefined;
  notify: NotifyFunction;
  log: LogFunction;
}) => {
  if (state === undefined) return;

  const messagesInTurn = selectMessagesInTurn(
    extractPiSessionMessages(ctx.sessionManager.getBranch()),
  );
  const formattedMessages = formatMessages(messagesInTurn);
  if (!formattedMessages) return;

  await persistCuratedMessages({
    ctx,
    state,
    messages: messagesInTurn,
    keyPrefix: "turn",
    content: `${state.config.persistPrompt.trim()}\n\nConversation:\n\n---\n${formattedMessages}`,
    notify,
    log,
  });
};

const maxCompactFlushMessages = 25;

export const flushBeforeCompact = async ({
  ctx,
  state,
  notify,
  log,
}: {
  ctx: ExtensionContext;
  state: RuntimeState | undefined;
  notify: NotifyFunction;
  log: LogFunction;
}) => {
  if (state === undefined) return;

  const allMessages = extractPiSessionMessages(ctx.sessionManager.getBranch());
  const messagesForFlush = allMessages.slice(-maxCompactFlushMessages);
  const formattedMessages = formatMessages(messagesForFlush);
  if (!formattedMessages) return;

  await persistCuratedMessages({
    ctx,
    state,
    messages: messagesForFlush,
    keyPrefix: "compact",
    content: formatCompactFlushContext(formattedMessages, state.config.maxCompactFlushChars),
    notify,
    log,
  });
};
