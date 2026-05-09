import type { ByteRoverBridgeLike } from "./bridges/types.js";

export type MemorySource = {
  label: string;
  cwd: string;
  bridge: ByteRoverBridgeLike;
};

export const formatMemorySource = (label: string, cwd: string, content: string) =>
  [`## ${label}`, `ByteRover cwd: ${cwd}`, "", content].join("\n");

export const formatMemorySourceContent = (
  source: MemorySource,
  content: string,
  includeSourceLabel: boolean,
) => (includeSourceLabel ? formatMemorySource(source.label, source.cwd, content) : content);
