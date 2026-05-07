import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";

export const resolveBrvCwd = (configuredCwd: string | undefined, cwd: string) => {
  if (configuredCwd === undefined) return cwd;
  if (configuredCwd === "~") return homedir();
  if (configuredCwd.startsWith("~/")) return resolve(homedir(), configuredCwd.slice(2));
  return isAbsolute(configuredCwd) ? configuredCwd : resolve(cwd, configuredCwd);
};
