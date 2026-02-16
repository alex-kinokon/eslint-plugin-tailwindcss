/**
 * @fileoverview Utility functions for AST
 */

import { uniq } from "es-toolkit";
import type { Rule } from "eslint";
import type * as ESTree from "estree";

import type { ArgNode } from "../types";

const separatorRegEx = /([\t\n\f\r ]+)/;

export type ParseCallback = (classNames: string[], targetNode: ArgNode | null) => void;

interface ExtractedClassNamesResult {
  classNames: string[];
  whitespaces: string[];
  headSpace: boolean;
  tailSpace: boolean;
}

export function calleeToString(
  node: Rule.Node | ESTree.Expression | ESTree.Super
): string | undefined {
  if (node.type === "Identifier") {
    return node.name;
  }
  if (
    node.type === "MemberExpression" &&
    node.object.type === "Identifier" &&
    node.property.type === "Identifier"
  ) {
    return `${node.object.name}.${node.property.name}`;
  }
  return;
}

/**
 * Find out if node is `class` or `className`
 *
 * @param node The AST node being checked
 * @param classRegex Regex to test the attribute that is being checked against
 */
export function isClassAttribute(node: ArgNode, classRegex: string): boolean {
  let name = "";
  switch (node.type) {
    case "JSXAttribute":
      if (node.name.type === "JSXNamespacedName") {
        const ns = node.name.namespace.name || "";
        name = (ns.length ? ns + ":" : "") + node.name.name.name;
      } else {
        name = node.name.name;
      }
      break;

    default:
      return false;
  }
  return new RegExp(classRegex).test(name);
}

/**
 * Find out if node's value attribute is just simple text
 *
 * @param node The AST node being checked
 */
export function isLiteralAttributeValue(node: ArgNode): boolean {
  if (node.type === "JSXAttribute" && node.value) {
    switch (node.value.type) {
      case "Literal":
        // No support for dynamic or conditional...
        return !/[?{}]/.test(String(node.value.value));
      case "JSXExpressionContainer":
        // className={"..."}
        return node.value.expression.type === "Literal";
    }
  }
  return false;
}

export function getExpressionFromExpressionContainer(
  valueNode: unknown
): ArgNode | undefined {
  if (
    valueNode &&
    typeof valueNode === "object" &&
    "type" in valueNode &&
    (valueNode as { type?: string }).type === "JSXExpressionContainer" &&
    "expression" in valueNode
  ) {
    return (valueNode as { expression: ArgNode }).expression;
  }
  return undefined;
}

/**
 * Find out if the node is a valid candidate for our rules
 *
 * @param node The AST node being checked
 * @param classRegex Regex to test the attribute that is being checked against
 */
export function isValidJSXAttribute(node: ArgNode, classRegex: string): boolean {
  if (!isClassAttribute(node, classRegex)) {
    // Only run for class[Name] attributes
    return false;
  }
  if (!isLiteralAttributeValue(node)) {
    // No support for dynamic or conditional classnames
    return false;
  }
  return true;
}

export function extractRangeFromNode(node: ArgNode): [number, number] {
  if (node.type !== "JSXAttribute") {
    return [0, 0];
  }
  if (node.value == null) {
    return [0, 0];
  }
  switch (node.value.type) {
    case "JSXExpressionContainer":
      return node.value.expression.range ?? [0, 0];
    default:
      return "range" in node.value && Array.isArray(node.value.range)
        ? node.value.range
        : [0, 0];
  }
}

export function extractValueFromNode(node: ArgNode): unknown {
  if (node.type !== "JSXAttribute") {
    return;
  }
  if (node.value == null) {
    return;
  }

  switch (node.value.type) {
    case "JSXExpressionContainer":
      if ("value" in node.value.expression) {
        return node.value.expression.value;
      }
      return;
    default:
      return "value" in node.value ? node.value.value : undefined;
  }
}

export function extractClassnamesFromValue(classStr: unknown): ExtractedClassNamesResult {
  if (typeof classStr !== "string") {
    return {
      classNames: [],
      whitespaces: [],
      headSpace: false,
      tailSpace: false,
    };
  }
  const parts = classStr.split(separatorRegEx);
  if (parts[0] === "") {
    parts.shift();
  }
  if (parts.at(-1) === "") {
    parts.pop();
  }
  const headSpace = separatorRegEx.test(parts[0]);
  const tailSpace = separatorRegEx.test(parts.at(-1)!);

  const classNames = parts.filter((_, i) => (headSpace ? i % 2 !== 0 : i % 2 === 0));
  const whitespaces = parts.filter((_, i) => (headSpace ? i % 2 === 0 : i % 2 !== 0));
  return {
    classNames,
    whitespaces,
    headSpace,
    tailSpace,
  };
}

export function walkClassStringNodes(
  rootNode: ArgNode,
  childNode: ArgNode | null | undefined,
  cb: (value: unknown, sourceNode: ArgNode | null) => void
): void {
  if (childNode === undefined) {
    return;
  }
  if (childNode === null) {
    cb(extractValueFromNode(rootNode), null);
    return;
  }

  switch (childNode.type) {
    case "Identifier":
      return;
    case "TemplateLiteral":
      for (const exp of childNode.expressions) {
        walkClassStringNodes(rootNode, exp, cb);
      }
      for (const quasis of childNode.quasis) {
        walkClassStringNodes(rootNode, quasis, cb);
      }
      return;
    case "ConditionalExpression":
      walkClassStringNodes(rootNode, childNode.consequent, cb);
      walkClassStringNodes(rootNode, childNode.alternate, cb);
      return;
    case "LogicalExpression":
      walkClassStringNodes(rootNode, childNode.right, cb);
      return;
    case "ArrayExpression":
      for (const el of childNode.elements) {
        walkClassStringNodes(rootNode, el ?? null, cb);
      }
      return;
    case "ObjectExpression": {
      const isUsedByClassNamesPlugin =
        rootNode.type === "CallExpression" &&
        calleeToString(rootNode.callee) === "classnames";
      for (const prop of childNode.properties) {
        if (prop.type === "SpreadElement") {
          continue;
        }
        const propVal = isUsedByClassNamesPlugin ? prop.key : prop.value;
        walkClassStringNodes(rootNode, propVal, cb);
      }
      return;
    }
    case "Property":
      walkClassStringNodes(rootNode, childNode.key, cb);
      return;
    case "Literal":
      cb(childNode.value, childNode);
      return;
    case "TemplateElement":
      if (childNode.value.raw === "") {
        return;
      }
      cb(childNode.value.raw, childNode);
      return;
  }
}

/**
 * Inspect and parse an abstract syntax node and run a callback function
 *
 * @param rootNode The current root node being parsed by eslint
 * @param childNode The AST node child argument being checked
 * @param cb The callback function
 * @param skipConditional Optional, indicate distinct parsing for conditional nodes
 * @param isolate Optional, set internally to isolate parsing and validation on conditional children
 * @param ignoredKeys Optional, set object keys which should not be parsed e.g. for `cva`
 */
export function parseNodeRecursive(
  rootNode: ArgNode,
  childNode: ArgNode | null | undefined,
  cb: ParseCallback,
  skipConditional = false,
  isolate = false,
  ignoredKeys: string[] = []
): void {
  let originalClassNamesValue: unknown;
  let classNames: string[];
  if (childNode === null) {
    originalClassNamesValue = extractValueFromNode(rootNode);
    ({ classNames } = extractClassnamesFromValue(originalClassNamesValue));
    classNames = uniq(classNames);
    if (classNames.length === 0) {
      // Don't run for empty className
      return;
    }
    cb(classNames, rootNode);
  } else if (childNode === undefined) {
    // Ignore invalid child candidates (probably inside complex TemplateLiteral)
    return;
  } else {
    const forceIsolation = skipConditional ? true : isolate;
    switch (childNode.type) {
      case "TemplateLiteral":
        for (const exp of childNode.expressions) {
          parseNodeRecursive(
            rootNode,
            exp,
            cb,
            skipConditional,
            forceIsolation,
            ignoredKeys
          );
        }
        for (const quasis of childNode.quasis) {
          parseNodeRecursive(rootNode, quasis, cb, skipConditional, isolate, ignoredKeys);
        }
        return;
      case "ConditionalExpression":
        parseNodeRecursive(
          rootNode,
          childNode.consequent,
          cb,
          skipConditional,
          forceIsolation,
          ignoredKeys
        );
        parseNodeRecursive(
          rootNode,
          childNode.alternate,
          cb,
          skipConditional,
          forceIsolation,
          ignoredKeys
        );
        return;
      case "LogicalExpression":
        parseNodeRecursive(
          rootNode,
          childNode.right,
          cb,
          skipConditional,
          forceIsolation,
          ignoredKeys
        );
        return;
      case "ArrayExpression":
        for (const el of childNode.elements) {
          parseNodeRecursive(
            rootNode,
            el ?? null,
            cb,
            skipConditional,
            forceIsolation,
            ignoredKeys
          );
        }
        return;
      case "ObjectExpression":
        for (const prop of childNode.properties) {
          const isUsedByClassNamesPlugin =
            rootNode.type === "CallExpression" &&
            rootNode.callee.type === "Identifier" &&
            rootNode.callee.name === "classnames";

          if (prop.type === "SpreadElement") {
            // Ignore spread elements
            continue;
          }

          if (prop.key.type === "Identifier" && ignoredKeys.includes(prop.key.name)) {
            // Ignore specific keys defined in settings
            continue;
          }

          parseNodeRecursive(
            rootNode,
            isUsedByClassNamesPlugin ? prop.key : prop.value,
            cb,
            skipConditional,
            forceIsolation,
            ignoredKeys
          );
        }
        return;
      case "Property":
        if (childNode.key.type !== "Identifier") {
          return;
        }
        parseNodeRecursive(
          rootNode,
          childNode.key,
          cb,
          skipConditional,
          forceIsolation,
          ignoredKeys
        );
        return;
      case "Literal":
        originalClassNamesValue = childNode.value;
        break;
      case "TemplateElement":
        originalClassNamesValue = childNode.value.raw;
        break;
    }
    ({ classNames } = extractClassnamesFromValue(originalClassNamesValue));
    classNames = uniq(classNames);
    if (classNames.length === 0) {
      // Don't run for empty className
      return;
    }
    const targetNode = isolate ? null : rootNode;
    cb(classNames, targetNode);
  }
}

export function getTemplateElementPrefix(text: string, raw: string): string {
  const idx = text.indexOf(raw);
  if (idx === 0) {
    return "";
  }
  return text.split(raw).shift() ?? "";
}

export function getTemplateElementSuffix(text: string, raw: string): string {
  if (!text.includes(raw)) {
    return "";
  }
  return text.split(raw).pop() ?? "";
}

export function getTemplateElementBody(
  text: string,
  prefix: string,
  suffix: string
): string {
  let arr = text.split(prefix);
  arr.shift();
  const body = arr.join(prefix);
  arr = body.split(suffix);
  arr.pop();
  return arr.join(suffix);
}
