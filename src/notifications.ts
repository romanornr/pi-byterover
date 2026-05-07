import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ByteroverConfig } from "./config-loader.js";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type NotifyType = "info" | "warning" | "error";

export type LogFunction = (level: LogLevel, message: string) => void;
export type NotifyFunction = (
  ctx: ExtensionContext,
  type: NotifyType,
  message: string,
  config?: Pick<ByteroverConfig, "quiet">,
) => void;

export const logBrv: LogFunction = (level, message) => {
  void level;
  void message;
};

export const notifyBrv: NotifyFunction = (ctx, type, message, config) => {
  if (config?.quiet) return;
  if (!ctx.hasUI) return;
  ctx.ui.notify(message, type);
};

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
