import path from "node:path";

import { runAsWorker } from "synckit";

import { resolve } from "./customConfig.ts";
import type { ResolvedTailwindConfig, TailwindConfigInput } from "./tailwindTypes.ts";

runAsWorker(async (twConfig: TailwindConfigInput): Promise<ResolvedTailwindConfig> => {
  const tailwindUtils = resolve(twConfig);
  if (!tailwindUtils.context) {
    const pwd =
      typeof twConfig === "string" && twConfig !== ""
        ? path.dirname(path.resolve(twConfig))
        : process.cwd();
    await tailwindUtils.loadConfig(twConfig, pwd);
  }
  const tailwindConfig = tailwindUtils.context?.tailwindConfig;
  if (!tailwindConfig) {
    throw new Error("Failed to resolve Tailwind config");
  }
  return tailwindConfig as ResolvedTailwindConfig;
});
