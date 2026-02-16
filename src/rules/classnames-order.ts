/**
 * @fileoverview Use a consistent orders for the Tailwind CSS classnames, based on property then on variants
 * @author François Massart
 */

import type { Rule } from "eslint";

import { removeDuplicates, sharedSchema } from "../types.ts";
import {
  extractClassnamesFromValue,
  extractRangeFromNode,
  getTemplateElementBody,
  getTemplateElementPrefix,
  getTemplateElementSuffix,
  walkClassStringNodes,
} from "../util/ast.ts";
import { createClassnameVisitors } from "../util/ruleVisitors.ts";
import { getOptions } from "../util/settings.ts";
import { getSortedClassNames } from "../util/tailwindAPI.ts";
import { docsUrl } from "../util/utils.ts";

const INVALID_CLASSNAMES_ORDER_MSG =
  "Ordre invalide des noms de classes Tailwind CSS.\nInvalid Tailwind CSS classnames order";

const rule: Rule.RuleModule = {
  meta: {
    docs: {
      description:
        "Enforce a consistent and logical order of the Tailwind CSS classnames",
      category: "Stylistic Issues",
      recommended: false,
      url: docsUrl("classnames-order"),
    },
    messages: {
      invalidOrder: INVALID_CLASSNAMES_ORDER_MSG,
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          ...sharedSchema,
          removeDuplicates,
        },
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
      removeDuplicates,
    } = getOptions(context);

    return createClassnameVisitors({
      callees,
      tags,
      classRegex,
      skipClassAttribute,
      parseNode(node, arg = null) {
        walkClassStringNodes(node, arg, (value, sourceNode) => {
          let originalClassNamesValue: unknown = value;
          let start: number | null = null;
          let end: number | null = null;
          let prefix = "";
          let suffix = "";
          if (sourceNode === null) {
            const range = extractRangeFromNode(node);
            start = range[0] + 1;
            end = range[1] - 1;
          } else if (sourceNode.type === "Literal") {
            start = sourceNode.range![0] + 1;
            end = sourceNode.range![1] - 1;
          } else if (sourceNode.type === "TemplateElement") {
            start = sourceNode.range![0];
            end = sourceNode.range![1];
            // https://github.com/eslint/eslint/issues/13360
            // The problem is that range computation includes the backticks (`test`)
            // but value.raw does not include them, so there is a mismatch.
            // start/end does not include the backticks, therefore it matches value.raw.
            const txt = context.sourceCode.getText(sourceNode);
            prefix = getTemplateElementPrefix(txt, originalClassNamesValue as string);
            suffix = getTemplateElementSuffix(txt, originalClassNamesValue as string);
            originalClassNamesValue = getTemplateElementBody(txt, prefix, suffix);
          }

          const { classNames, whitespaces, headSpace, tailSpace } =
            extractClassnamesFromValue(originalClassNamesValue);

          if (classNames.length <= 1) {
            // Don't run sorting for a single or empty className
            return;
          }

          const orderedClassNames = getSortedClassNames(twConfig, classNames);

          if (removeDuplicates) {
            removeDuplicatesFromClassnamesAndWhitespaces(
              orderedClassNames,
              whitespaces,
              headSpace,
              tailSpace
            );
          }

          // Generates the validated/sorted attribute value
          let validatedClassNamesValue = "";
          for (let i = 0; i < orderedClassNames.length; i++) {
            const w = whitespaces[i] ?? "";
            const cls = orderedClassNames[i];
            validatedClassNamesValue += headSpace ? `${w}${cls}` : `${cls}${w}`;
            if (headSpace && tailSpace && i === orderedClassNames.length - 1) {
              validatedClassNamesValue += whitespaces.at(-1) ?? "";
            }
          }

          if (originalClassNamesValue !== validatedClassNamesValue) {
            validatedClassNamesValue = prefix + validatedClassNamesValue + suffix;
            context.report({
              node,
              messageId: "invalidOrder",
              fix(fixer: Rule.RuleFixer) {
                if (start === null || end === null) {
                  return null;
                }
                return fixer.replaceTextRange([start, end], validatedClassNamesValue);
              },
            });
          }
        });
      },
    });
  },
};

function removeDuplicatesFromClassnamesAndWhitespaces(
  orderedClassNames: string[],
  whitespaces: string[],
  headSpace: boolean,
  tailSpace: boolean
): void {
  let previous = orderedClassNames[0];
  const offset = (!headSpace && !tailSpace) || tailSpace ? -1 : 0;
  for (let i = 1; i < orderedClassNames.length; i++) {
    const cls = orderedClassNames[i];
    // This function assumes that the list of classNames is ordered, so just comparing to the previous className is enough
    if (cls === previous) {
      orderedClassNames.splice(i, 1);
      whitespaces.splice(i + offset, 1);
      i--;
    }
    previous = cls;
  }
}

export default rule;
