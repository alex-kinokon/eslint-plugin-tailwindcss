/**
 * @fileoverview Recommended coniguration for flat style
 * @see https://eslint.org/docs/latest/use/configure/configuration-files-new
 * @author François Massart
 */

import type { Linter } from "eslint";

import { plugin } from "../index.ts";

import { rules } from "./rules.ts";

export const flatRecommended: Linter.Config[] = [
  {
    name: "tailwindcss:base",
    plugins: {
      get tailwindcss() {
        return plugin;
      },
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    name: "tailwindcss:rules",
    rules,
  },
];
