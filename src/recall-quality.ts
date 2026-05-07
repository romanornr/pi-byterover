export type RecallQualityStatus = "sufficient" | "partial" | "insufficient" | "conflicting";

export type RecallQuality = {
  status: RecallQualityStatus;
  reason: string;
  policy: string;
  matchedAnchors: Array<string>;
  missingAnchors: Array<string>;
};

type RecallQualityInput = {
  latestPrompt: string;
  projectCwd: string;
  formattedMessages: string;
  content: string;
};

const weakAnchors = new Set([
  "agent",
  "automatic",
  "byterover",
  "code",
  "context",
  "current",
  "gateway",
  "gitnexus",
  "handover",
  "hermes",
  "implement",
  "injected",
  "injection",
  "latest",
  "memory",
  "message",
  "project",
  "prompt",
  "quality",
  "recall",
  "remember",
  "request",
  "session",
  "system",
  "task",
  "tools",
  "user",
]);

const tokenPattern = /[a-z0-9]+(?:[-_./@][a-z0-9]+)*/giu;

const normalize = (value: string) => value.toLowerCase();

const unique = (values: Array<string>) => [...new Set(values)];

const basename = (path: string) =>
  path
    .replace(/[/\\]+$/u, "")
    .split(/[/\\]/u)
    .at(-1) ?? path;

const extractRawAnchors = (text: string) =>
  Array.from(text.matchAll(tokenPattern), (match) => normalize(match[0]))
    .flatMap((token) => {
      const parts = token.split(/[-_./@]/u).filter(Boolean);
      return [token, ...parts];
    })
    .filter((token) => token.length >= 4 && !weakAnchors.has(token));

const extractProjectAnchors = (projectCwd: string) => {
  const base = normalize(basename(projectCwd));
  const parts = base.split(/[-_./@]/u).filter(Boolean);
  const prefixes = parts.slice(0, -1).map((_, index) => parts.slice(0, index + 2).join("-"));
  return unique([base, ...prefixes, ...extractRawAnchors(base)]).filter(
    (anchor) => !weakAnchors.has(anchor),
  );
};

const extractTaskAnchors = (latestPrompt: string) => unique(extractRawAnchors(latestPrompt));

const contentContainsAnchor = (content: string, anchor: string) => {
  const escaped = anchor.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const boundary =
    anchor.includes("-") || anchor.includes("_") || anchor.includes("/") || anchor.includes("@")
      ? `(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`
      : `\\b${escaped}\\b`;
  return new RegExp(boundary, "iu").test(content);
};

const hasConflictMarker = (content: string) =>
  /\b(?:conflict(?:ing)?|contradict(?:s|ion|ory)?|stale|outdated|superseded)\b/iu.test(content);

export const shouldInjectRecallQuality = (quality: Pick<RecallQuality, "status">) =>
  quality.status !== "insufficient";

export const evaluateRecallQuality = ({
  latestPrompt,
  projectCwd,
  formattedMessages,
  content,
}: RecallQualityInput): RecallQuality => {
  const projectAnchors = extractProjectAnchors(projectCwd);
  const taskAnchorSource = latestPrompt.trim() ? latestPrompt : formattedMessages;
  const taskAnchors = extractTaskAnchors(taskAnchorSource);
  const requiredAnchors = unique([...projectAnchors, ...taskAnchors]).slice(0, 24);
  const normalizedContent = normalize(content);
  const matchedAnchors = requiredAnchors.filter((anchor) =>
    contentContainsAnchor(normalizedContent, anchor),
  );
  const missingAnchors = requiredAnchors.filter((anchor) => !matchedAnchors.includes(anchor));
  const projectMatches = projectAnchors.filter((anchor) => matchedAnchors.includes(anchor));
  const taskMatches = taskAnchors.filter((anchor) => matchedAnchors.includes(anchor));

  if (hasConflictMarker(content) && matchedAnchors.length > 0) {
    return {
      status: "conflicting",
      reason: `Recalled context matches ${matchedAnchors.length} anchor(s) but contains conflict or stale markers.`,
      policy: "Verify current source-of-truth files and tools before relying on recalled memory.",
      matchedAnchors,
      missingAnchors,
    };
  }

  if (projectMatches.length > 0 && taskMatches.length >= 2) {
    return {
      status: "sufficient",
      reason: `Recalled context matches project anchor(s) ${projectMatches.join(", ")} and ${taskMatches.length} task anchor(s).`,
      policy:
        "Use this as reference context, not authority; current files, tools, and user input still win.",
      matchedAnchors,
      missingAnchors,
    };
  }

  if (projectMatches.length > 0 || taskMatches.length >= 2) {
    return {
      status: "partial",
      reason: `Recalled context has limited overlap: ${matchedAnchors.join(", ") || "no strong anchors"}.`,
      policy:
        "Use recalled memory only for covered facts; inspect source/tools for missing or current details.",
      matchedAnchors,
      missingAnchors,
    };
  }

  return {
    status: "insufficient",
    reason: "Recalled context has weak overlap with the current project and task anchors.",
    policy: "suppress recalled memory injection and continue without automatic memory context.",
    matchedAnchors,
    missingAnchors,
  };
};
