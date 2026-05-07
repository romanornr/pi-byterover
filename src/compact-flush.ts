export const formatCompactFlushContext = (formattedMessages: string, maxChars: number) => {
  const header = "[Pre-compaction context]";
  if (formattedMessages.length <= maxChars) return `${header}\n${formattedMessages}`;

  return (
    `${header}\n` +
    `[Earlier pre-compaction content omitted; kept the last ${maxChars} characters.]\n` +
    formattedMessages.slice(-maxChars).trimStart()
  );
};
