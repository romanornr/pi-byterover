/**
 * Builds the system-prompt guidance that tells agents when manual ByteRover tools
 * are appropriate versus when automatic recall/persist should handle memory.
 */
export const buildManualToolGuidance = (config: {
  autoRecall: boolean;
  autoPersist: boolean;
  readOnly?: boolean;
}) => {
  const guidance = [
    "ByteRover memory guidance:",
    `Automatic recall is ${config.autoRecall ? "enabled" : "disabled"}.`,
    `Automatic persist is ${config.autoPersist && !config.readOnly ? "enabled" : "disabled"}.`,
  ];

  if (config.readOnly) {
    guidance.push(
      "ByteRover is in read-only mode. Use recall/search for context, but do not persist new memories.",
    );
  } else if (config.autoRecall && config.autoPersist) {
    guidance.push(
      "Rely on automatic recall and automatic persist for routine memory behavior instead of consistently calling the manual tools.",
      "Use `brv_recall`, `brv_search`, or `brv_persist` when you need an extra targeted lookup, immediate durable save, or explicit user-requested memory operation.",
    );
  } else {
    guidance.push(
      "Use `brv_recall`, `brv_search`, and `brv_persist` when durable memory is useful because one or more automatic memory behaviors are disabled.",
    );
  }

  return guidance.join("\n");
};
