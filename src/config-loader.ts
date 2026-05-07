import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type * as z from "zod/v4";
import { ConfigSchema, configDefaults } from "./config.js";

export type ByteroverConfig = z.infer<typeof ConfigSchema>;

export type LoadConfigOptions = {
  cwd: string;
  homeDir?: string;
  createGlobalDefault?: boolean;
};

export type LoadConfigResult =
  | { success: true; config: ByteroverConfig; source?: string; created?: boolean }
  | { success: false; source: string; error: Error };

const hasCode = (error: unknown, code: string) => {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
};

const errorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : String(error);
};

const invalidConfig = (source: string, error: unknown): LoadConfigResult => ({
  success: false,
  source,
  error: new Error(`Invalid Byterover configuration in ${source}: ${errorMessage(error)}`),
});

const generatedGlobalConfig = {
  ...configDefaults,
  brvCwd: "~/.pi/agent/memory/byterover",
};

const writeGeneratedGlobalConfig = async (source: string): Promise<LoadConfigResult> => {
  const raw = `${JSON.stringify(generatedGlobalConfig, null, 2)}\n`;

  try {
    await mkdir(dirname(source), { recursive: true });
    await writeFile(source, raw, { encoding: "utf8", flag: "wx" });
    return {
      success: true,
      source,
      created: true,
      config: ConfigSchema.parse(generatedGlobalConfig),
    };
  } catch (error) {
    if (!hasCode(error, "EEXIST")) return invalidConfig(source, error);
  }

  try {
    return {
      success: true,
      source,
      config: ConfigSchema.parse(JSON.parse(await readFile(source, "utf8"))),
    };
  } catch (error) {
    return invalidConfig(source, error);
  }
};

export const loadConfig = async ({
  cwd,
  homeDir = homedir(),
  createGlobalDefault = false,
}: LoadConfigOptions): Promise<LoadConfigResult> => {
  const globalConfigPath = join(homeDir, ".pi", "agent", "byterover.json");
  const candidates = [join(cwd, ".pi", "byterover.json"), globalConfigPath];

  for (const source of candidates) {
    let raw: string;
    try {
      raw = await readFile(source, "utf8");
    } catch (error) {
      if (hasCode(error, "ENOENT")) continue;
      return invalidConfig(source, error);
    }

    try {
      return { success: true, source, config: ConfigSchema.parse(JSON.parse(raw)) };
    } catch (error) {
      return invalidConfig(source, error);
    }
  }

  if (createGlobalDefault) return writeGeneratedGlobalConfig(globalConfigPath);

  return { success: true, config: ConfigSchema.parse(undefined) };
};
