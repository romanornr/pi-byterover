import { describe, expect, test } from "vitest";
import { evaluateRecallQuality, shouldInjectRecallQuality } from "./recall-quality.js";

describe("recall-quality", () => {
  test("classifies unrelated ByteRover recall as insufficient", () => {
    const quality = evaluateRecallQuality({
      latestPrompt:
        "Continue the pi-byterover task: add a recall-quality gateway for pi-memory/pi-memctx style memory injection noise.",
      projectCwd: "/home/romano/github/pi-byterover",
      formattedMessages:
        "[user]: Handover for /home/romano/github/pi-byterover. Ignore unrelated Rio, qmd, voice TTS, and junior employee memories.",
      content: [
        "### rio_tmux_session_status",
        "Rio terminal windows using tmux may freeze and need recovery.",
        "### qmd_wiki_indexing",
        "qmd update/embed processed wiki documents.",
        "### stt_enabled",
        "Speech-to-text is enabled.",
        "### voice_auto_tts",
        "Voice auto TTS settings were changed.",
        "### junior_employee_task_strategy",
        "A junior helper should only handle bounded test/data work.",
      ].join("\n"),
    });

    expect(quality.status).toBe("insufficient");
    expect(quality.policy).toContain("suppress");
    expect(shouldInjectRecallQuality(quality)).toBe(false);
  });

  test("classifies project recall with missing task coverage as partial", () => {
    const quality = evaluateRecallQuality({
      latestPrompt: "Add a recall-quality gateway for noisy ByteRover injection.",
      projectCwd: "/home/romano/github/pi-byterover",
      formattedMessages: "[user]: Implement recall quality around automatic memory injection.",
      content: "pi-byterover is a Pi extension that injects ByteRover recall before agent startup.",
    });

    expect(quality.status).toBe("partial");
    expect(quality.policy).toContain("Use recalled memory only for covered facts");
    expect(shouldInjectRecallQuality(quality)).toBe(true);
  });

  test("classifies clearly project-and-task-specific recall as sufficient", () => {
    const quality = evaluateRecallQuality({
      latestPrompt: "Implement a recall-quality gateway for pi-byterover memory injection.",
      projectCwd: "/home/romano/github/pi-byterover",
      formattedMessages: "[user]: pi-byterover should suppress noisy ByteRover recall injection.",
      content:
        "pi-byterover should add a recall-quality gateway around ByteRover recall so unrelated memory injection is suppressed before formatRecallContext.",
    });

    expect(quality.status).toBe("sufficient");
    expect(quality.policy).toContain("reference context");
    expect(shouldInjectRecallQuality(quality)).toBe(true);
  });
});
