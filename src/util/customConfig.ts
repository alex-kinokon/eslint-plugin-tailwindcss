import { TailwindUtils } from "../tailwind-api-utils.ts";

import type { TailwindConfigInput } from "./tailwindTypes.ts";

// for nativewind preset
process.env.TAILWIND_MODE = "build";

const CHECK_REFRESH_RATE = 10_000;
const lastCheck = new Map<TailwindConfigInput, number>();

const mergedConfig = new Map<TailwindConfigInput, TailwindUtils>();

export function resolve(twConfig: TailwindConfigInput): TailwindUtils {
  const newConfig = mergedConfig.get(twConfig) === undefined;
  const now = Date.now();
  const last = lastCheck.get(twConfig) ?? 0;
  const expired = now - last > CHECK_REFRESH_RATE;
  if (newConfig || expired) {
    lastCheck.set(twConfig, now);
    const tailwindUtils = new TailwindUtils();
    mergedConfig.set(twConfig, tailwindUtils);
  }
  return mergedConfig.get(twConfig)!;
}
