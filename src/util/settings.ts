import type { Rule } from "eslint";

import type { TailwindConfigInput } from "./tailwindTypes.ts";

interface OptionValueMap {
  callees: string[];
  ignoredKeys: string[];
  classRegex: string;
  config: TailwindConfigInput;
  cssFiles: string[];
  cssFilesRefreshRate: number;
  removeDuplicates: boolean;
  skipClassAttribute: boolean;
  tags: string[];
  whitelist: string[];
}

type OptionName = keyof OptionValueMap;

type SettingsTailwind = Partial<OptionValueMap> & Record<string, unknown>;

type ContextLike = Rule.RuleContext & {
  options: [Partial<OptionValueMap>?, ...unknown[]];
  settings: {
    tailwindcss?: SettingsTailwind;
  };
};

export function getOptions(context: ContextLike) {
  return {
    get callees() {
      return getOption(context, "callees");
    },
    get skipClassAttribute() {
      return getOption(context, "skipClassAttribute");
    },
    get tags() {
      return getOption(context, "tags");
    },
    get config() {
      return getOption(context, "config");
    },
    get classRegex() {
      return getOption(context, "classRegex");
    },
    get removeDuplicates() {
      return getOption(context, "removeDuplicates");
    },
    get ignoredKeys() {
      return getOption(context, "ignoredKeys");
    },
  };
}

function getOption<K extends OptionName>(
  context: ContextLike,
  name: K
): OptionValueMap[K] {
  // Options (defined at rule level)
  const options = context.options[0] ?? {};
  const optionValue = options[name];
  if (optionValue !== undefined) {
    return optionValue as OptionValueMap[K];
  }
  // Settings (defined at plugin level, shared across rules)
  const settingValue = context.settings.tailwindcss?.[name];
  if (settingValue !== undefined) {
    return settingValue as OptionValueMap[K];
  }
  // Fallback to defaults
  switch (name) {
    case "callees":
      return ["classnames", "clsx", "ctl", "cva", "tv"] as OptionValueMap[K];
    case "ignoredKeys":
      return ["compoundVariants", "defaultVariants"] as OptionValueMap[K];
    case "classRegex":
      return "^class(Name)?$" as OptionValueMap[K];
    case "config":
      return {} as OptionValueMap[K];
    case "cssFiles":
      return [
        "**/*.css",
        "!**/node_modules",
        "!**/.*",
        "!**/dist",
        "!**/build",
      ] as OptionValueMap[K];
    case "cssFilesRefreshRate":
      return 5_000 as OptionValueMap[K];
    case "removeDuplicates":
      return true as OptionValueMap[K];
    case "skipClassAttribute":
      return false as OptionValueMap[K];
    case "tags":
      return [] as unknown as OptionValueMap[K];
    case "whitelist":
      return [] as unknown as OptionValueMap[K];
  }
}
