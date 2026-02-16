/**
 * @fileoverview Rules enforcing best practices while using Tailwind CSS
 * @author François Massart
 */
import type { ESLint } from "eslint";

import { flatRecommended } from "./config/flat-recommended.ts";
import classnamesOrder from "./rules/classnames-order.ts";
import enforcesNegativeArbitraryValues from "./rules/enforces-negative-arbitrary-values.ts";
import enforcesShorthand from "./rules/enforces-shorthand.ts";
import noArbitraryValue from "./rules/no-arbitrary-value.ts";
import noContradictingClassname from "./rules/no-contradicting-classname.ts";
import noUnnecessaryArbitraryValue from "./rules/no-unnecessary-arbitrary-value.ts";

export type { ESLintPluginTailwindOptions } from "./types.ts";

export const plugin: ESLint.Plugin = {
  rules: {
    "classnames-order": classnamesOrder,
    "enforces-negative-arbitrary-values": enforcesNegativeArbitraryValues,
    "enforces-shorthand": enforcesShorthand,
    "no-arbitrary-value": noArbitraryValue,
    "no-contradicting-classname": noContradictingClassname,
    "no-unnecessary-arbitrary-value": noUnnecessaryArbitraryValue,
  },
  configs: {
    "flat/recommended": flatRecommended,
  },
};
