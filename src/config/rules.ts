/**
 * @fileoverview Default rules configuration
 * @author François Massart
 */

import type { Linter } from "eslint";

export const rules: Linter.RulesRecord = {
  "tailwindcss/classnames-order": "warn",
  "tailwindcss/enforces-negative-arbitrary-values": "warn",
  "tailwindcss/enforces-shorthand": "warn",
  "tailwindcss/no-arbitrary-value": "off",
  "tailwindcss/no-contradicting-classname": "off",
  "tailwindcss/no-unnecessary-arbitrary-value": "warn",
};
