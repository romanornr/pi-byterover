import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadConfig } from "./config-loader.js";
import { resolveBrvCwd } from "./cwd.js";
import { ensureBrvGitignore } from "./gitignore.js";
import { buildManualToolGuidance } from "./manual-guidance.js";
import { recallBeforeAgentStart } from "./memory-manager.js";
import { errorMessage, logBrv, notifyBrv, type NotifyType } from "./notifications.js";
import { flushBeforeCompact, curateTurn } from "./persistence.js";
import { createBridgeFactory, createRuntimeState, type RuntimeState } from "./runtime.js";
import { registerManualTools } from "./tools.js";

export { buildManualToolGuidance };

export default function byterover(pi: ExtensionAPI) {
  let runtime: RuntimeState | undefined;
  let eventHandlersRegistered = false;

  const registerRuntimeEventHandlers = () => {
    if (eventHandlersRegistered) return;
    eventHandlersRegistered = true;

    pi.on("before_agent_start", async (event, ctx) =>
      recallBeforeAgentStart({ event, ctx, state: runtime, notify: notifyBrv, log: logBrv }),
    );
    pi.on("agent_end", async (_event, ctx) => {
      await curateTurn({ ctx, state: runtime, notify: notifyBrv, log: logBrv });
    });
    pi.on("session_before_compact", async (_event, ctx) => {
      await flushBeforeCompact({ ctx, state: runtime, notify: notifyBrv, log: logBrv });
    });
  };

  pi.on("session_start", async (_event, ctx) => {
    const configResult = await loadConfig({ cwd: ctx.cwd, createGlobalDefault: true });
    if (!configResult.success) {
      runtime = undefined;
      notifyBrv(ctx, "error", "Invalid ByteRover configuration");
      logBrv("error", configResult.error.message);
      return;
    }

    const { config } = configResult;
    if (!config.enabled) {
      runtime = undefined;
      return;
    }

    const brvCwd = resolveBrvCwd(config.brvCwd, ctx.cwd);

    try {
      if (!config.readOnly) await ensureBrvGitignore(brvCwd);
    } catch (error) {
      notifyBrv(
        ctx,
        "warning",
        "Failed to initialize ByteRover storage, some features may not work",
        config,
      );
      logBrv("warn", `Failed to bootstrap .brv/.gitignore: ${errorMessage(error)}`);
    }

    const createBridge = createBridgeFactory(config, brvCwd, logBrv);
    const bridge = createBridge();
    const autoRecallBridge = createBridge({ recallTimeoutMs: config.autoRecallTimeoutMs });
    const autoPersistBridge = createBridge({ persistTimeoutMs: config.autoPersistTimeoutMs });
    const readOnlyMemorySources = config.readOnlyMemories.enabled
      ? config.readOnlyMemories.cwds.map((configuredCwd, index) => {
          const cwd = resolveBrvCwd(configuredCwd, ctx.cwd);
          return { label: `Read-only memory ${index + 1}`, cwd, bridge: createBridge({ cwd }) };
        })
      : [];
    const autoRecallMemorySources = [
      { label: "Primary memory", cwd: brvCwd, bridge: autoRecallBridge },
      ...(config.readOnlyMemories.enabled
        ? config.readOnlyMemories.cwds.map((configuredCwd, index) => {
            const cwd = resolveBrvCwd(configuredCwd, ctx.cwd);
            return {
              label: `Read-only memory ${index + 1}`,
              cwd,
              bridge: createBridge({ cwd, recallTimeoutMs: config.autoRecallTimeoutMs }),
            };
          })
        : []),
    ];
    runtime = createRuntimeState({
      config,
      bridge,
      autoRecallBridge,
      autoPersistBridge,
      brvCwd,
      readOnlyMemorySources,
      autoRecallMemorySources,
    });

    if (config.manualTools) {
      registerManualTools({
        pi,
        config,
        bridge,
        createBridge,
        brvCwd,
        readOnlyMemorySources,
        log: logBrv,
        notify: (type: NotifyType, message: string) => notifyBrv(ctx, type, message, config),
      } as Parameters<typeof registerManualTools>[0] & {
        log: typeof logBrv;
        notify: (type: NotifyType, message: string) => void;
      });
    }

    registerRuntimeEventHandlers();
  });
}
