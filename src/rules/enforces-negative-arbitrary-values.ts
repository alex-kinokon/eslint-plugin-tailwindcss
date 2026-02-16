/**
 * @fileoverview Warns about `-` prefixed classnames using arbitrary values
 * @author François Massart
 */

import type { Rule } from "eslint";

import { sharedSchema } from "../types.ts";
import { extractClassnamesFromValue, walkClassStringNodes } from "../util/ast.ts";
import { getSuffix } from "../util/groupMethods.ts";
import { createClassnameVisitors } from "../util/ruleVisitors.ts";
import { getOptions } from "../util/settings.ts";
import { docsUrl } from "../util/utils.ts";

const NEGATIVE_ARBITRARY_VALUE =
  "Le nom de classe à valeur arbitraire «\u202F{{classname}}\u202F» ne doit pas commencer par un tiret (-).\nArbitrary value classname '{{classname}}' should not start with a dash (-)";

const rule: Rule.RuleModule = {
  meta: {
    docs: {
      description: "Warns about dash prefixed classnames using arbitrary values",
      category: "Best Practices",
      recommended: true,
      url: docsUrl("enforces-negative-arbitrary-values"),
    },
    messages: {
      negativeArbitraryValue: NEGATIVE_ARBITRARY_VALUE,
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
    const { callees, skipClassAttribute, tags, classRegex } = getOptions(context);

    return createClassnameVisitors({
      callees,
      tags,
      classRegex,
      skipClassAttribute,
      parseNode(node, arg = null) {
        walkClassStringNodes(node, arg, originalClassNamesValue => {
          const { classNames } = extractClassnamesFromValue(originalClassNamesValue);

          const detected = classNames.filter(cls => {
            const suffix = getSuffix(cls);
            const negArbitraryValRegEx =
              /^-(?:(?:inset|scale)(?:-[xy])?|top|right|bottom|left|z|order|(?:scroll-)?m[blrtxy]?|(?:skew|space|translate)-[xy]|rotate|tracking|indent|(?:backdrop-)?hue-rotate)-\[.*]$/i;
            return negArbitraryValRegEx.test(suffix);
          });

          for (const className of detected) {
            context.report({
              node,
              messageId: "negativeArbitraryValue",
              data: {
                classname: className,
              },
            });
          }
        });
      },
    });
  },
};

export default rule;
