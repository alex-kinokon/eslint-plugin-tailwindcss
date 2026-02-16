import fs from "node:fs";
import { createRequire } from "node:module";
import path, { basename, extname } from "node:path";

import { createSyncFn } from "synckit";

import type { ResolvedTailwindConfig, TailwindConfigInput } from "./tailwindTypes.ts";

const require = createRequire(import.meta.url);
const opt = { tsRunner: "node", timeout: 1_000 } as const;

const paths = fs.readdirSync(import.meta.dirname);
const find = (name: string) =>
  require.resolve(`./${paths.find(n => basename(n, extname(n)) === name)}`);

const getTailwindConfigWorker = createSyncFn<
  (twConfig: TailwindConfigInput) => ResolvedTailwindConfig
>(find("getTailwindConfigWorker"), opt);

const getSortedClassNamesWorker = createSyncFn<
  (twConfig: TailwindConfigInput, classNames: string[]) => string[]
>(find("getSortedClassNamesWorker"), opt);

function normalizeTailwindConfig(twConfig: TailwindConfigInput): TailwindConfigInput {
  if (typeof twConfig === "string" && twConfig !== "" && !path.isAbsolute(twConfig)) {
    return path.resolve(process.cwd(), twConfig);
  }
  return twConfig;
}

export function getTailwindConfig(twConfig: TailwindConfigInput): ResolvedTailwindConfig {
  twConfig = normalizeTailwindConfig(twConfig);
  return getTailwindConfigWorker(twConfig);
}

export function getSortedClassNames(
  twConfig: TailwindConfigInput,
  classNames: string[]
): string[] {
  twConfig = normalizeTailwindConfig(twConfig);
  return getSortedClassNamesWorker(twConfig, classNames);
}
