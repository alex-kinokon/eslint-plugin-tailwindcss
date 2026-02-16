/**
 * @fileoverview Detect arbitrary classnames which have an existing equivalent preset in the configuration
 * @author François Massart
 */

import type { Rule } from "eslint";
import type * as ESTree from "estree";

import { groups as defaultGroups } from "../config/groups.ts";
import { type ArgNode, sharedSchema } from "../types.ts";
import {
  calleeToString,
  extractClassnamesFromValue,
  extractRangeFromNode,
  extractValueFromNode,
} from "../util/ast.ts";
import {
  getGroupConfigKeys,
  getGroupIndex,
  getGroups,
  parseClassname,
} from "../util/groupMethods.ts";
import { createClassnameVisitors } from "../util/ruleVisitors.ts";
import { getOptions } from "../util/settings.ts";
import { getTailwindConfig } from "../util/tailwindAPI.ts";
import { validZeroRegEx } from "../util/types/length.ts";
import { docsUrl } from "../util/utils.ts";

interface FixBatch {
  unjustified: string;
  substitute: string;
}

// TODO get the correct value of start and end
// TODO make rule fixable when only 1 match
// TODO propose several fixes when multiple matches + priority to exact match

const UNNECESSARY_ARBITRARY_VALUE_DETECTED_MSG =
  "La classe arbitraire «\u202F{{classname}}\u202F» pourrait être remplacée par «\u202F{{presets}}\u202F».\nThe arbitrary class '{{classname}}' could be replaced by '{{presets}}'";

const rule: Rule.RuleModule = {
  meta: {
    docs: {
      description:
        "Forbid using arbitrary values in classnames when an equivalent preset exists",
      category: "Best Practices",
      recommended: true,
      url: docsUrl("no-unnecessary-arbitrary-value"),
    },
    messages: {
      unnecessaryArbitraryValueDetected: UNNECESSARY_ARBITRARY_VALUE_DETECTED_MSG,
    },
    fixable: "code",
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
    const groups = getGroups(defaultGroups, mergedConfig);
    const configKeys = getGroupConfigKeys(defaultGroups);
    let parentTemplateLiteral: ESTree.TemplateLiteral | null = null;

    /**
     * Recursive function crawling into child nodes
     * @param node The root node of the current parsing
     * @param arg The child node of node
     */
    const parseForArbitraryValues = (node: ArgNode, arg: ArgNode | null = null): void => {
      let start: number | null = null;
      let end: number | null = null;
      let originalClassNamesValue: unknown = null;
      if (arg === null) {
        originalClassNamesValue = extractValueFromNode(node);
        const range = extractRangeFromNode(node);
        start = range[0] + 1;
        end = range[1] - 1;
      } else {
        switch (arg.type) {
          case "Identifier":
            return;
          case "TemplateLiteral":
            parentTemplateLiteral = arg;
            for (const exp of arg.expressions) {
              parseForArbitraryValues(node, exp);
            }
            for (const quasis of arg.quasis) {
              parseForArbitraryValues(node, quasis);
            }
            parentTemplateLiteral = null;
            return;
          case "ConditionalExpression":
            parseForArbitraryValues(node, arg.consequent);
            parseForArbitraryValues(node, arg.alternate);
            return;
          case "LogicalExpression":
            parseForArbitraryValues(node, arg.right);
            return;
          case "ArrayExpression":
            for (const el of arg.elements) {
              parseForArbitraryValues(node, el ?? null);
            }
            return;
          case "ObjectExpression":
            const isUsedByClassNamesPlugin =
              node.type === "CallExpression" &&
              calleeToString(node.callee) === "classnames";
            for (const prop of arg.properties) {
              if (prop.type === "SpreadElement") {
                continue;
              }
              const propVal = isUsedByClassNamesPlugin ? prop.key : prop.value;
              parseForArbitraryValues(node, propVal);
            }
            return;
          case "Property":
            parseForArbitraryValues(node, arg.key);
            if (!arg.range) {
              return;
            }
            start = arg.range[0] + 1;
            end = arg.range[1] - 1;
            return;
          case "Literal":
            if (!arg.range) {
              return;
            }
            originalClassNamesValue = arg.value;
            start = arg.range[0] + 1;
            end = arg.range[1] - 1;
            break;
          case "TemplateElement":
            if (!arg.range) {
              return;
            }
            originalClassNamesValue = arg.value.raw;
            if (originalClassNamesValue === "") {
              return;
            }
            start = arg.range[0];
            end = arg.range[1];
            if (parentTemplateLiteral && parentTemplateLiteral.range) {
              start++;
              end -= parentTemplateLiteral.range[1] === end ? 1 : 2;
            }
            break;
        }
      }

      // eslint-disable-next-line regexp/no-super-linear-backtracking
      const arbitraryRegEx = /^(?<backBone>.*)\[(?<arbitraryValue>.*)]$/;
      const { classNames } = extractClassnamesFromValue(originalClassNamesValue);
      const arbitraryClassnames = classNames.filter(c => arbitraryRegEx.test(c));

      if (arbitraryClassnames.length === 0) {
        return;
      }

      const unnecessaryArbitraryClasses: string[] = [];
      const existingSubstitutes: string[][] = [];

      for (const [idx, arbitraryClass] of arbitraryClassnames.entries()) {
        const parsed = parseClassname(arbitraryClass, [], mergedConfig, idx);
        const res = arbitraryRegEx.exec(parsed.name);
        if (res && res.groups && res.groups.backBone && res.groups.arbitraryValue) {
          const backBone = res.groups.backBone;
          const arbitraryValue = res.groups.arbitraryValue;
          const groupIdx = getGroupIndex(arbitraryClass, groups);
          if (groupIdx < 0) {
            continue;
          }
          const canBeNegative = groups[groupIdx].includes("?<negativeValue>");
          const isNegativeClass = parsed.body.startsWith("-");
          const isNegativeValue = arbitraryValue.startsWith("-");
          const configurationKey = configKeys[groupIdx];
          if (configurationKey === null) {
            continue;
          }
          const configuration = mergedConfig.theme[configurationKey];
          if (typeof configuration !== "object" || configuration === null) {
            continue;
          }
          const configurationRecord = configuration;
          const configurationKeys = Object.keys(configurationRecord);
          const zeroValueWithOrWithoutUnitsPattern = new RegExp(validZeroRegEx, "i");
          const isZeroArbitraryValue =
            zeroValueWithOrWithoutUnitsPattern.test(arbitraryValue);
          const negativeSubstitutes: boolean[] = [];
          const matchingConfigurationKeys = configurationKeys.filter(key => {
            const configValue = configurationRecord[key];
            const configValueStr = String(configValue);
            if (
              isZeroArbitraryValue &&
              zeroValueWithOrWithoutUnitsPattern.test(configValueStr)
            ) {
              // Both config and tested values are 0 based (with or without units)
              negativeSubstitutes.push(false);
              return true;
            }
            // Negative possibilities
            if (canBeNegative) {
              const absoluteValue = isNegativeValue
                ? arbitraryValue.slice(1)
                : arbitraryValue;
              const computedAsNegative = isNegativeClass !== isNegativeValue;
              if (configValueStr === absoluteValue) {
                negativeSubstitutes.push(computedAsNegative);
                return true;
              }
              return false;
            }
            // Default
            if (configValueStr === arbitraryValue) {
              negativeSubstitutes.push(false);
              return true;
            }
            return false;
          });
          if (matchingConfigurationKeys.length) {
            unnecessaryArbitraryClasses.push(parsed.name);
            existingSubstitutes.push(
              matchingConfigurationKeys.map((key: string, idx: number) => {
                let patchedBody = backBone.slice(parsed.variants.length);
                patchedBody =
                  patchedBody.charAt(0) === "-" ? patchedBody.slice(1) : patchedBody;
                const noneOrMinus = negativeSubstitutes[idx] ? "-" : "";
                if (key === "DEFAULT") {
                  return (
                    parsed.variants +
                    noneOrMinus +
                    patchedBody.slice(0, Math.max(0, patchedBody.length - 1))
                  );
                }
                return parsed.variants + noneOrMinus + patchedBody + key;
              })
            );
          }
        }
      }

      // TODO Group by range and bundle the fix
      const fixables: Record<string, FixBatch[] | undefined> = Object.create(null);
      for (const [idx, forbiddenClass] of unnecessaryArbitraryClasses.entries()) {
        if (existingSubstitutes[idx].length === 1) {
          const rangeKey = `s${start}e${end}`;
          fixables[rangeKey] ??= [];
          const fixer = {
            unjustified: forbiddenClass,
            substitute: existingSubstitutes[idx][0],
          };
          fixables[rangeKey].push(fixer);
        } else {
          context.report({
            node,
            messageId: "unnecessaryArbitraryValueDetected",
            data: {
              classname: forbiddenClass,
              presets: existingSubstitutes[idx].join("' or '"),
            },
          });
        }
      }
      for (const batchFixes of Object.values(fixables)) {
        let patched = String(originalClassNamesValue);
        const forbiddenClasses: string[] = [];
        const substitutes: string[] = [];
        for (const batchFix of batchFixes ?? []) {
          // BUG replace could affect same class with distinct variants... eg. h-0 might affect min-h-0
          const unjustified = batchFix.unjustified;
          forbiddenClasses.push(unjustified);
          const substitute = batchFix.substitute;
          substitutes.push(substitute);
          patched = patched.replace(unjustified, substitute);
        }
        context.report({
          node,
          messageId: "unnecessaryArbitraryValueDetected",
          data: {
            classname: forbiddenClasses.join(", "),
            presets: substitutes.join(", "),
          },
          fix(fixer) {
            if (start === null || end === null) {
              return null;
            }
            return fixer.replaceTextRange([start, end], patched);
          },
        });
      }
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
