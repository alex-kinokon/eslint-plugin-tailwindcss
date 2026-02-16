import { dirname, resolve } from "node:path";

import { runAsWorker } from "synckit";

import { resolve as resolveConfig } from "./customConfig.ts";
import type { TailwindConfigInput } from "./tailwindTypes.ts";

runAsWorker(
  async (twConfig: TailwindConfigInput, classNames: string[]): Promise<string[]> => {
    const tailwindUtils = resolveConfig(twConfig);
    if (!tailwindUtils.context) {
      const pwd =
        typeof twConfig === "string" && twConfig !== ""
          ? dirname(resolve(twConfig))
          : process.cwd();
      await tailwindUtils.loadConfig(twConfig, pwd);
    }
    return tailwindUtils.getSortedClassNames(classNames);
  }
);
