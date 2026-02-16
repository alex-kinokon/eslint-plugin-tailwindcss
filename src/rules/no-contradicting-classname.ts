/**
 * @fileoverview Avoid contradicting Tailwind CSS classnames (e.g. "w-3 w-5")
 * @author François Massart
 */
import type { Rule } from "eslint";

import { groups as defaultGroups } from "../config/groups.ts";
import { type ArgNode, extractTagName, sharedSchema } from "../types.ts";
import {
  type ParseCallback,
  calleeToString,
  getExpressionFromExpressionContainer,
  isClassAttribute,
  isLiteralAttributeValue,
  parseNodeRecursive,
} from "../util/ast.ts";
import {
  getArbitraryProperty,
  getGroupIndex,
  getGroups,
  getPrefix,
  getSuffix,
} from "../util/groupMethods.ts";
import { getOptions } from "../util/settings.ts";
import { getTailwindConfig } from "../util/tailwindAPI.ts";
import { docsUrl } from "../util/utils.ts";

interface VariantGroup {
  prefix: string;
  name: string[];
}

const CONFLICTING_CLASSNAMES_DETECTED_MSG =
  "Les noms de classes {{classnames}} sont en conflit.\nClassnames {{classnames}} are conflicting.";

// Sorts each groups' classnames
const ambiguousArbitraryValuesOrClasses = String.raw`(\[(.*:))|(^((?!:).)*$)`;

const rule: Rule.RuleModule = {
  meta: {
    docs: {
      description: 'Avoid contradicting Tailwind CSS classnames (e.g. "w-3 w-5")',
      category: "Possible Errors",
      recommended: true,
      url: docsUrl("no-contradicting-classname"),
    },
    messages: {
      conflictingClassnames: CONFLICTING_CLASSNAMES_DETECTED_MSG,
    },
    fixable: undefined,
    schema: [
      {
        type: "object",
        properties: sharedSchema,
      },
    ],
  },

  create(context) {
    const {
      callees,
      skipClassAttribute,
      tags,
      ignoredKeys,
      config: twConfig,
      classRegex,
    } = getOptions(context);

    const mergedConfig = getTailwindConfig(twConfig);

    // Init assets before sorting
    const groups = getGroups(defaultGroups, mergedConfig);

    const parseNode = (
      rootNode: ArgNode,
      childNode: ArgNode | null | undefined,
      cb: ParseCallback
    ) => parseNodeRecursive(rootNode, childNode, cb, true, false, ignoredKeys);

    /**
     * Parse the classnames and report found conflicts
     */
    const parseForContradictingClassNames: ParseCallback = (classNames, node) => {
      // Init assets before sorting
      const sorted: string[][] = groups.map(() => []);

      // Move each classname inside its dedicated group
      for (const className of classNames) {
        const idx = getGroupIndex(className, groups);
        if (idx > -1) {
          sorted[idx].push(className);
        }
      }

      // Only multiple classNames
      const sortedGroups = sorted.filter(slot => slot.length > 1);
      const arbitraryPropsGroupIndex = sortedGroups.findIndex(slot => {
        const suffix = getSuffix(slot[0]);
        return getArbitraryProperty(suffix) !== "";
      });

      for (const [groupIndex, group] of sortedGroups.entries()) {
        const variants: VariantGroup[] = [];
        for (const cls of group) {
          const prefix = getPrefix(cls);
          const name = cls.slice(prefix.length);
          if (groupIndex === arbitraryPropsGroupIndex) {
            // Arbitrary Props
            const arbitraryProp = getArbitraryProperty(name);
            const identifier = prefix + arbitraryProp;
            const idx = variants.findIndex(v => identifier === v.prefix);
            if (idx === -1) {
              variants.push({
                prefix: identifier,
                name: [name],
              });
            } else {
              variants[idx].name.push(name);
            }
          } else {
            // "Regular classNames"
            const rePrefix =
              prefix === "" ? ambiguousArbitraryValuesOrClasses : "^" + prefix;
            const idx = variants.findIndex(v => v.prefix === rePrefix);
            if (idx === -1) {
              variants.push({
                prefix: rePrefix,
                name: [name],
              });
            } else {
              variants[idx].name.push(name);
            }
          }
        }

        // Several classNames with the same prefix
        const potentialTroubles = variants.filter(v => v.name.length > 1);
        if (node != null && potentialTroubles.length) {
          for (const variantGroup of potentialTroubles) {
            const re = new RegExp(variantGroup.prefix);
            const conflicting = group.filter(c => re.test(c));
            context.report({
              node,
              messageId: "conflictingClassnames",
              data: {
                classnames: conflicting.join(", "),
              },
            });
          }
        }
      }
    };

    return {
      JSXAttribute(node) {
        if (!isClassAttribute(node, classRegex) || skipClassAttribute) {
          return;
        }
        if (isLiteralAttributeValue(node)) {
          parseNode(node, null, parseForContradictingClassNames);
        } else {
          const expressionNode = getExpressionFromExpressionContainer(
            (node as { value?: unknown }).value
          );
          if (expressionNode) {
            parseNode(node, expressionNode, parseForContradictingClassNames);
          }
        }
      },
      CallExpression(node) {
        const calleeStr = calleeToString(node.callee);
        if (!callees.some(name => calleeStr === name)) {
          return;
        }
        const allClassnamesForNode: string[] = [];
        const pushClasses: ParseCallback = (classNames: string[], targetNode): void => {
          if (targetNode === null) {
            // Classnames should be parsed in isolation (e.g. conditional expressions)
            parseForContradictingClassNames(classNames, node);
          } else {
            // Gather the classes prior to validation
            allClassnamesForNode.push(...classNames);
          }
        };
        for (const arg of node.arguments) {
          parseNode(node, arg, pushClasses);
        }
        parseForContradictingClassNames(allClassnamesForNode, node);
      },
      TaggedTemplateExpression(node) {
        const tagName = extractTagName(node.tag);
        if (!tagName || !tags.includes(tagName)) {
          return;
        }

        const allClassnamesForNode: string[] = [];
        const pushClasses: ParseCallback = (classNames: string[], targetNode): void => {
          if (targetNode === null) {
            // Classnames should be parsed in isolation (e.g. conditional expressions)
            parseForContradictingClassNames(classNames, node);
          } else {
            // Gather the classes prior to validation
            allClassnamesForNode.push(...classNames);
          }
        };
        parseNode(node, node.quasi, pushClasses);
        parseForContradictingClassNames(allClassnamesForNode, node);
      },
    };
  },
};

export default rule;
