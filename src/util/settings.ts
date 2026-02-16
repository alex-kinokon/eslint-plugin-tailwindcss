import type { Rule } from "eslint";

import type { ESLintPluginTailwindOptions } from "../types.ts";

type OptionValueMap = Required<ESLintPluginTailwindOptions>;
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

const defaultOptions: OptionValueMap = {
  callees: ["classnames", "clsx", "ctl", "cva", "tv"],
  ignoredKeys: ["compoundVariants", "defaultVariants"],
  classRegex: "^class(Name)?$",
  config: {},
  cssFiles: ["**/*.css", "!**/node_modules", "!**/.*", "!**/dist", "!**/build"],
  cssFilesRefreshRate: 5_000,
  removeDuplicates: true,
  skipClassAttribute: false,
  tags: [],
  whitelist: [],
};

function getOption<K extends keyof OptionValueMap>(
  context: ContextLike,
  name: K
): OptionValueMap[K] {
  return (
    // Options (defined at rule level)
    (context.options[0] ?? {})[name] ??
    // Settings (defined at plugin level, shared across rules)
    context.settings.tailwindcss?.[name] ??
    // Fallback to defaults
    defaultOptions[name]
  );
}
