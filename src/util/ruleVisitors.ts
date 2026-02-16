import type { Rule } from "eslint";

import type { ArgNode } from "../types.ts";
import { extractTagName } from "../types.ts";

import {
  calleeToString,
  getExpressionFromExpressionContainer,
  isClassAttribute,
  isLiteralAttributeValue,
} from "./ast.ts";

export function createClassnameVisitors({
  callees,
  tags,
  classRegex,
  skipClassAttribute,
  parseNode,
}: {
  callees: string[];
  tags: string[];
  classRegex: string;
  skipClassAttribute: boolean;
  parseNode: (node: ArgNode, arg?: ArgNode | null) => void;
}): Rule.RuleListener {
  return {
    JSXAttribute(node): void {
      if (!isClassAttribute(node, classRegex) || skipClassAttribute) {
        return;
      }
      if (isLiteralAttributeValue(node)) {
        parseNode(node);
        return;
      }

      const expressionNode = getExpressionFromExpressionContainer(
        (node as { value?: unknown }).value
      );
      if (expressionNode) {
        parseNode(node, expressionNode);
      }
    },
    CallExpression(node): void {
      const calleeStr = calleeToString(node.callee);
      if (!callees.some(name => calleeStr === name)) {
        return;
      }
      for (const arg of node.arguments) {
        parseNode(node, arg);
      }
    },
    TaggedTemplateExpression(node): void {
      const name = extractTagName(node.tag);
      if (name && !tags.includes(name)) {
        return;
      }
      parseNode(node, node.quasi);
    },
  };
}
