/**
 * @fileoverview Forbid using arbitrary values in classnames
 * @author François Massart
 */

import type { Rule } from "eslint";

import { type ArgNode, sharedSchema } from "../types.ts";
import { extractClassnamesFromValue, walkClassStringNodes } from "../util/ast.ts";
import { parseClassname } from "../util/groupMethods.ts";
import { createClassnameVisitors } from "../util/ruleVisitors.ts";
import { getOptions } from "../util/settings.ts";
import { getTailwindConfig } from "../util/tailwindAPI.ts";
import { docsUrl } from "../util/utils.ts";

// Rule Definition

// Predefine message for use in context.report conditional.
// messageId will still be usable in tests.
const ARBITRARY_VALUE_DETECTED_MSG =
  "Valeur arbitraire détectée dans «\u202F{{classname}}\u202F».\nArbitrary value detected in '{{classname}}'";

const rule: Rule.RuleModule = {
  meta: {
    docs: {
      description: "Forbid using arbitrary values in classnames",
      category: "Best Practices",
      recommended: false,
      url: docsUrl("no-arbitrary-value"),
    },
    messages: {
      arbitraryValueDetected: ARBITRARY_VALUE_DETECTED_MSG,
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
      config: twConfig,
      classRegex,
    } = getOptions(context);
    const mergedConfig = getTailwindConfig(twConfig);

    /**
     * Traverse class-bearing child nodes and validate found class strings.
     */
    const parseForArbitraryValues = (node: ArgNode, arg: ArgNode | null = null): void => {
      walkClassStringNodes(node, arg, originalClassNamesValue => {
        const { classNames } = extractClassnamesFromValue(originalClassNamesValue);
        const forbidden: string[] = [];
        for (const [idx, cls] of classNames.entries()) {
          const parsed = parseClassname(cls, [], mergedConfig, idx);
          if (/\[.*]/.test(parsed.body)) {
            forbidden.push(parsed.name);
          }
        }

        for (const forbiddenClass of forbidden) {
          context.report({
            node,
            messageId: "arbitraryValueDetected",
            data: {
              classname: forbiddenClass,
            },
          });
        }
      });
    };

    return createClassnameVisitors({
      callees,
      tags,
      classRegex,
      skipClassAttribute,
      parseNode: parseForArbitraryValues,
    });
  },
};

export default rule;
