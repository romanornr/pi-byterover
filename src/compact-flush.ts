/**
 * Formats the transcript slice persisted immediately before Pi compacts a session.
 * Keeps the newest text when the formatted branch exceeds the configured budget.
 */
export const formatCompactFlushContext = (formattedMessages: string, maxChars: number) => {
  const header = "[Pre-compaction context]";
  if (formattedMessages.length <= maxChars) return `${header}\n${formattedMessages}`;

  return (
    `${header}\n` +
    `[Earlier pre-compaction content omitted; kept the last ${maxChars} characters.]\n` +
    formattedMessages.slice(-maxChars).trimStart()
  );
};
