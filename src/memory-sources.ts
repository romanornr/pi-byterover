import type { BrvBridge } from "@byterover/brv-bridge";

export type MemorySource = {
  label: string;
  cwd: string;
  bridge: BrvBridge;
};

export const formatMemorySource = (label: string, cwd: string, content: string) =>
  [`## ${label}`, `ByteRover cwd: ${cwd}`, "", content].join("\n");

export const formatMemorySourceContent = (
  source: MemorySource,
  content: string,
  includeSourceLabel: boolean,
) => (includeSourceLabel ? formatMemorySource(source.label, source.cwd, content) : content);
