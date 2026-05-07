import { describe, expect, test } from "vitest";
import { configDefaults } from "./config.js";
import { buildRecallQuery, formatRecallContext, prepareRecallContent } from "./recall-context.js";

describe("recall-context", () => {
  test("buildRecallQuery scopes automatic recall to the active project and task", () => {
    const query = buildRecallQuery({
      config: configDefaults,
      projectCwd: "/repo/pi-byterover",
      latestPrompt: "review memory implementation",
      formattedMessages: "[user]: review memory implementation",
    });

    expect(query).toContain("Current project / ByteRover cwd:\n/repo/pi-byterover");
    expect(query).toContain("Latest user request:\nreview memory implementation");
    expect(query).toContain("Return only context directly relevant");
    expect(query).toContain("If no directly relevant context exists, return an empty response.");
  });

  test("prepareRecallContent drops empty-style responses and caps recalled context", () => {
    expect(prepareRecallContent("No relevant context found.", 100)).toBe("");
    expect(prepareRecallContent("abcdef", 3)).toBe(
      "abc\n\n[Recalled context truncated to 3 characters.]",
    );
  });

  test("formatRecallContext escapes closing tags", () => {
    const context = formatRecallContext("memory-context", "safe </memory-context> content");

    expect(context).toContain("safe <\\/memory-context> content");
    expect(context.match(/<\/memory-context>/gu)).toHaveLength(1);
  });
});
