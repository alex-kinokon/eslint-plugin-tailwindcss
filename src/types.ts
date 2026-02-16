import type { Rule } from "eslint";
import type * as ES from "estree";
import type { JSXAttribute, JSXEmptyExpression } from "estree-jsx";

import type { TailwindConfigInput } from "./util/tailwindTypes";

export interface ESLintPluginTailwindOptions {
  /** These are the default values but feel free to customize */
  readonly callees?: Array<"classnames" | "clsx" | "ctl" | "cva" | (string & {})>;
  /** returned from `loadConfig()` utility if not provided */
  readonly config?: TailwindConfigInput;
  readonly cssFiles?: Array<
    "**/*.css" | "!**/node_modules" | "!**/.*" | "!**/dist" | "!**/build" | (string & {})
  >;
  readonly cssFilesRefreshRate?: number;
  readonly removeDuplicates?: boolean;
  readonly skipClassAttribute?: boolean;
  readonly whitelist?: string[];
  /** can be set to e.g. ['tw'] for use in tw`bg-blue` */
  readonly tags?: Array<"tw" | (string & {})>;
  /* can be modified to support custom attributes. E.g. "^tw$" for `twin.macro` */
  readonly classRegex?: string;
  readonly ignoredKeys?: string[];
}

export type ArgNode =
  | Rule.Node
  | JSXAttribute
  | JSXEmptyExpression
  | ES.Expression
  | ES.TemplateElement
  | ES.SpreadElement
  | ES.ObjectPattern
  | ES.PrivateIdentifier
  | ES.ArrayPattern
  | ES.RestElement
  | ES.AssignmentPattern;

export function extractTagName(tag: Rule.Node | ES.Expression): string | undefined {
  if (tag.type === "Identifier") {
    return tag.name;
  } else if (tag.type === "MemberExpression" && tag.object.type === "Identifier") {
    return tag.object.name;
  } else if (tag.type === "CallExpression" && tag.callee.type === "Identifier") {
    return tag.callee.name;
  }
  return;
}

// #region schema
export const removeDuplicates = {
  // default: true,
  type: "boolean",
} as const;

export const sharedSchema = {
  callees: {
    type: "array",
    items: { type: "string", minLength: 0 },
    uniqueItems: true,
  },
  ignoredKeys: {
    type: "array",
    items: { type: "string", minLength: 0 },
    uniqueItems: true,
  },
  config: {
    type: ["string", "object"],
  },
  tags: {
    type: "array",
    items: { type: "string", minLength: 0 },
    uniqueItems: true,
  },
} as const;
// #endregion
