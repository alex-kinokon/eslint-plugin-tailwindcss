/**
 * @fileoverview Avoid using multiple Tailwind CSS classnames when not required (e.g. "mx-3 my-3" could be replaced by "m-3")
 * @author François Massart
 */

import type { Rule } from "eslint";

import { type GroupParentNode, groups as defaultGroups } from "../config/groups.ts";
import { type ArgNode, sharedSchema } from "../types.ts";
import {
  extractClassnamesFromValue,
  extractRangeFromNode,
  getTemplateElementBody,
  getTemplateElementPrefix,
  getTemplateElementSuffix,
  walkClassStringNodes,
} from "../util/ast.ts";
import { parseClassname } from "../util/groupMethods.ts";
import { createClassnameVisitors } from "../util/ruleVisitors.ts";
import { getOptions } from "../util/settings.ts";
import { getTailwindConfig } from "../util/tailwindAPI.ts";
import { docsUrl } from "../util/utils.ts";

type ShorthandMode = "exact" | "value";

interface ComplexEquivalence {
  needles: string[];
  shorthand: string;
  mode: ShorthandMode;
}

interface ParsedClassname {
  name: string;
  body: string;
  value: string;
  variants: string;
  important: boolean;
  parentType: string;
  shorthand: string;
  index: number;
  leading: string;
  trailing: string;
}

const SHORTHAND_CANDIDATE_CLASSNAMES_DETECTED_MSG =
  "Les noms de classes «\u202F{{classnames}}\u202F» pourraient être remplacés par la forme abrégée «\u202F{{shorthand}}\u202F».\nClassnames '{{classnames}}' could be replaced by the '{{shorthand}}' shorthand.";

// Init assets
const targetProperties: Record<string, string[] | undefined> = {
  __proto__: null!,
  Layout: ["Overflow", "Overscroll Behavior", "Top / Right / Bottom / Left"],
  "Flexbox & Grid": ["Gap"],
  Spacing: ["Padding", "Margin"],
  Sizing: ["Width", "Height"],
  Borders: ["Border Radius", "Border Width", "Border Color"],
  Tables: ["Border Spacing"],
  Transforms: ["Scale"],
  Typography: ["Text Overflow", "Whitespace"],
};
const targetPropertiesKeys = new Set(Object.keys(targetProperties));

const placeContentOptions = [
  "center",
  "start",
  "end",
  "between",
  "around",
  "evenly",
  "baseline",
  "stretch",
];
const placeItemsOptions = ["start", "end", "center", "stretch"];
const placeSelfOptions = ["auto", "start", "end", "center", "stretch"];
// These are shorthand candidates that do not share the same parent type
const complexEquivalences: ComplexEquivalence[] = [
  {
    needles: ["overflow-hidden", "text-ellipsis", "whitespace-nowrap"],
    shorthand: "truncate",
    mode: "exact",
  },
  {
    needles: ["w-", "h-"],
    shorthand: "size-",
    mode: "value",
  },
  ...placeContentOptions.map(
    (opt): ComplexEquivalence => ({
      needles: [`content-${opt}`, `justify-${opt}`],
      shorthand: `place-content-${opt}`,
      mode: "exact",
    })
  ),
  ...placeItemsOptions.map(
    (opt): ComplexEquivalence => ({
      needles: [`items-${opt}`, `justify-items-${opt}`],
      shorthand: `place-items-${opt}`,
      mode: "exact",
    })
  ),
  ...placeSelfOptions.map(
    (opt): ComplexEquivalence => ({
      needles: [`self-${opt}`, `justify-self-${opt}`],
      shorthand: `place-self-${opt}`,
      mode: "exact",
    })
  ),
];

const rule: Rule.RuleModule = {
  meta: {
    docs: {
      description: "Enforces the usage of shorthand Tailwind CSS classnames",
      category: "Best Practices",
      recommended: true,
      url: docsUrl("enforces-shorthand"),
    },
    messages: {
      shorthandCandidateDetected: SHORTHAND_CANDIDATE_CLASSNAMES_DETECTED_MSG,
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

    // We don't want to affect other rules by object reference
    const targetGroups = (defaultGroups as GroupParentNode[])
      .filter(({ type }) => targetPropertiesKeys.has(type))
      .map(({ members, type, ...rest }) => ({
        ...rest,
        type,
        members: members.filter(sub => targetProperties[type]?.includes(sub.type)),
      }));

    /**
     * Retrieve the main part of a classname base on its shorthand scope
     * @param targetGroups A specific subset of the groups
     * @param parentType The name of the parent e.g. 'Border Radius'
     * @param shorthand The searched shorthand e.g. 'all', 'y', 't', 'tr'
     */
    const getBodyByShorthand = (
      targetGroupsArg: GroupParentNode[],
      parentType: string,
      shorthand: string
    ): string => {
      const findByMemberType = (obj: GroupParentNode) =>
        obj.members.find(m => m.type === parentType);
      const mainGroup = targetGroupsArg.find(findByMemberType);
      if (!mainGroup) {
        return "";
      }

      const typeGroup = (mainGroup.members as GroupParentNode[]).find(
        m => m.type === parentType
      );
      // const typeGroup = mainGroup.find(findByMemberType);
      if (!typeGroup) {
        return "";
      }

      const type = (typeGroup.members as GroupParentNode[]).find(
        m => m.shorthand === shorthand
      );
      return type?.body ?? "";
    };

    /**
     * Parse the classnames and report found shorthand candidates
     * @param node The root node of the current parsing
     * @param arg The child node of node
     */
    const parseForShorthandCandidates = (
      node: ArgNode,
      arg: ArgNode | null = null
    ): void => {
      walkClassStringNodes(node, arg, (value, sourceNode) => {
        let originalClassNamesValue: unknown = value;
        let start: number | null = null;
        let end: number | null = null;
        let prefix = "";
        let suffix = "";
        const troubles: Array<[string[], string]> = [];
        if (sourceNode === null) {
          const range = extractRangeFromNode(node);
          start = range[0] + 1;
          end = range[1] - 1;
        } else if (sourceNode.type === "Literal") {
          start = sourceNode.range?.[0] ?? 0;
          end = sourceNode.range?.[1] ?? 0;
          start += 1;
          end -= 1;
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

        const parsed: ParsedClassname[] = [];

        for (const [index, className] of classNames.entries()) {
          parsed.push(
            parseClassname(
              className,
              targetGroups,
              mergedConfig,
              index
            ) as ParsedClassname
          );
        }

        const validated: ParsedClassname[] = [];

        // Handle sets of classnames with different parent types
        let remaining = parsed;
        for (const {
          needles: inputSet,
          shorthand: outputClassname,
          mode,
        } of complexEquivalences) {
          if (remaining.length < inputSet.length) {
            continue;
          }

          // Matching classes
          const parsedElementsInInputSet = remaining.filter(remainingClass => {
            const { name, body, value } = remainingClass;

            if (mode === "exact") {
              // Test if the name contains the target class, eg. 'text-ellipsis' inside 'md:text-ellipsis'...
              return inputSet.some(inputClass => name.includes(inputClass));
            } else {
              // Test if the body of the class matches, eg. 'h-' inside 'h-10'
              const bodyMatch = inputSet.some(
                inputClassPattern => `${mergedConfig.prefix}${inputClassPattern}` === body
              );

              const theme = mergedConfig.theme as Record<
                string,
                Record<string, string | undefined> | undefined
              >;

              if (
                !theme.size![value] ||
                !theme.width ||
                !theme.width[value] ||
                !theme.height ||
                !theme.height[value]
              ) {
                return false;
              }
              // w-screen + h-screen ≠ size-screen (Issue #307)
              const sizeKeys = Object.keys(theme.size!);
              const isSize = /[hw]-/.test(body);
              const isValidSize = sizeKeys.includes(value);
              const wValue = theme.width[value];
              const hValue = theme.height[value];
              const sizeValue = theme.size![value];
              const fullMatch = wValue === hValue && wValue === sizeValue;
              return bodyMatch && !(isSize && !isValidSize && !fullMatch);
            }
          });

          const variantGroups = new Map<string, ParsedClassname[]>();
          for (const o of parsedElementsInInputSet) {
            const val = mode === "value" ? o.value : "";
            const v = `${o.variants}${o.important ? "!" : ""}${val}`;
            if (!variantGroups.has(v)) {
              variantGroups.set(
                v,
                parsedElementsInInputSet.filter(
                  c =>
                    c.variants === o.variants &&
                    c.important === o.important &&
                    (val === "" || c.value === val)
                )
              );
            }
          }
          const validKeys = new Set<string>();
          for (const [key, classes] of variantGroups.entries()) {
            let skip = false;
            // Make sure all required classes for the shorthand are present
            if (classes.length < inputSet.length) {
              skip = true;
            }
            // Make sure the classes share all the single/shared/same value
            if (mode === "value" && new Set(classes.map(p => p.value)).size !== 1) {
              skip = true;
            }
            if (!skip) {
              validKeys.add(key);
            }
          }
          for (const k of validKeys) {
            const candidates = variantGroups.get(k)!;
            const index = candidates[0].index;
            const variants = candidates[0].variants;
            const important = candidates[0].important ? "!" : "";
            const classValue = mode === "value" ? candidates[0].value : "";

            const patchedClassname = `${variants}${important}${mergedConfig.prefix}${outputClassname}${classValue}`;
            troubles.push([candidates.map(c => c.name), patchedClassname]);

            const validatedClassname = parseClassname(
              patchedClassname,
              targetGroups,
              mergedConfig,
              index
            ) as ParsedClassname;
            validated.push(validatedClassname);

            remaining = remaining.filter(p => !candidates.includes(p));
          }
        }

        // Handle sets of classnames with the same parent type
        // Each group parentType
        const checkedGroups: string[] = [];
        for (const classname of remaining) {
          // Valid candidate
          if (classname.parentType === "") {
            validated.push(classname);
            continue;
          } else if (checkedGroups.includes(classname.parentType)) {
            continue;
          }

          checkedGroups.push(classname.parentType);
          const sameType = remaining.filter(
            cls => cls.parentType === classname.parentType
          );
          // Comparing same parentType classnames
          const checkedVariantsValue: string[] = [];
          for (const cls of sameType) {
            const key = cls.variants + (cls.important ? "!" : "") + cls.value;
            if (checkedVariantsValue.includes(key)) {
              continue;
            }
            checkedVariantsValue.push(key);
            const sameVariantAndValue = sameType.filter(
              v =>
                !(
                  v.variants !== cls.variants ||
                  v.value !== cls.value ||
                  v.important !== cls.important
                )
            );
            if (sameVariantAndValue.length === 1) {
              validated.push(cls);
              continue;
            } else if (!sameVariantAndValue.length) {
              continue;
            }

            const shortHands = new Set(sameVariantAndValue.map(c => c.shorthand));

            const supportCorners = classname.parentType === "Border Radius";
            const hasTL =
              supportCorners &&
              (shortHands.has("all") || shortHands.has("t") || shortHands.has("tl"));
            const hasTR =
              supportCorners &&
              (shortHands.has("all") || shortHands.has("t") || shortHands.has("tr"));
            const hasBR =
              supportCorners &&
              (shortHands.has("all") || shortHands.has("b") || shortHands.has("br"));
            const hasBL =
              supportCorners &&
              (shortHands.has("all") || shortHands.has("b") || shortHands.has("bl"));

            const hasT = shortHands.has("t") || (hasTL && hasTR);
            const hasR = shortHands.has("r") || (hasTR && hasBR);
            const hasB = shortHands.has("b") || (hasBL && hasBR);
            const hasL = shortHands.has("l") || (hasTL && hasBL);
            const hasX = shortHands.has("x") || (hasL && hasR);
            const hasY = shortHands.has("y") || (hasT && hasB);
            const hasAllProp = shortHands.has("all");
            const hasAllPropNoCorner = hasY && hasX;
            const hasAllPropWithCorners = (hasL && hasR) || (hasT && hasB);
            const hasAllEquivalent = !supportCorners
              ? hasAllPropNoCorner
              : hasAllPropWithCorners;
            const hasAll = hasAllProp || hasAllEquivalent;
            const important = cls.important ? "!" : "";
            const isNegative = cls.value.startsWith("-");
            const minus = isNegative ? "-" : "";
            const absoluteVal = isNegative ? cls.value.slice(1) : cls.value;

            if (hasAll) {
              const all = getBodyByShorthand(targetGroups, classname.parentType, "all");
              const val = absoluteVal.length ? "-" + absoluteVal : "";
              const patchedName = `${cls.variants}${important}${minus}${mergedConfig.prefix}${all}${val}`;
              troubles.push([sameVariantAndValue.map(c => c.name), patchedName]);
              cls.name = patchedName;
              cls.shorthand = "all";
              validated.push(cls);
            } else if (hasY || hasX) {
              const xOrY = hasX ? "x" : "y";
              const xOrYType = getBodyByShorthand(
                targetGroups,
                classname.parentType,
                xOrY
              );
              const patchedName = `${cls.variants}${important}${minus}${mergedConfig.prefix}${xOrYType}${
                absoluteVal.length ? "-" + absoluteVal : ""
              }`;

              const toBeReplaced = sameVariantAndValue
                .filter(hasX ? isLR : isTB)
                .map(c => c.name);

              const toBeKept = sameVariantAndValue.filter(hasY ? isLR : isTB);

              troubles.push([toBeReplaced, patchedName]);
              let replaced = false;
              for (const ref of sameVariantAndValue) {
                if (toBeKept.some(k => k.name === ref.name)) {
                  validated.push(ref);
                } else if (!replaced) {
                  replaced = true;
                  const cloned = JSON.parse(JSON.stringify(ref)) as ParsedClassname;
                  cloned.name = patchedName;
                  cloned.shorthand = xOrY;
                  validated.push(cloned);
                }
              }
            } else if (supportCorners && (hasT || hasR || hasB || hasL)) {
              const side = hasT ? "t" : hasR ? "r" : hasB ? "b" : "l";
              const sideBody = getBodyByShorthand(
                targetGroups,
                classname.parentType,
                side
              );
              const val = absoluteVal.length ? "-" + absoluteVal : "";
              const patchedName = `${cls.variants}${important}${minus}${mergedConfig.prefix}${sideBody}${val}`;
              const toBeReplaced = sameVariantAndValue
                .filter(c => {
                  const candidates = hasT
                    ? ["tl", "tr"]
                    : hasR
                      ? ["tr", "br"]
                      : hasB
                        ? ["bl", "br"]
                        : ["tl", "bl"];
                  return candidates.includes(c.shorthand);
                })
                .map(c => c.name);
              const toBeKept = sameVariantAndValue.filter(c => {
                const candidates = hasT
                  ? ["bl", "br"]
                  : hasR
                    ? ["tl", "bl"]
                    : hasB
                      ? ["tl", "tr"]
                      : ["tr", "br"];
                return candidates.includes(c.shorthand);
              });

              troubles.push([toBeReplaced, patchedName]);
              let replaced = false;
              for (const ref of sameVariantAndValue) {
                if (toBeKept.some(k => k.name === ref.name)) {
                  validated.push(ref);
                } else if (!replaced) {
                  replaced = true;
                  const cloned = JSON.parse(JSON.stringify(ref)) as ParsedClassname;
                  cloned.name = patchedName;
                  cloned.shorthand = side;
                  validated.push(cloned);
                }
              }
            } else {
              validated.push(...sameVariantAndValue);
            }
          }
        }

        // Try to keep the original order
        validated.sort((a: ParsedClassname, b: ParsedClassname) =>
          a.index < b.index ? -1 : 1
        );

        // Generates the validated attribute value
        const union = validated.map(val => val.leading + val.name + val.trailing);

        let validatedClassNamesValue = "";

        // Generates the validated attribute value
        if (union.length === 1) {
          validatedClassNamesValue += headSpace ? whitespaces[0] : "";
          validatedClassNamesValue += union[0];
          validatedClassNamesValue += tailSpace ? whitespaces.at(-1) : "";
        } else {
          for (let i = 0; i < union.length; i++) {
            const isLast = i === union.length - 1;
            const w = whitespaces[i] ?? "";
            const cls = union[i];
            validatedClassNamesValue += headSpace
              ? `${w}${cls}`
              : isLast
                ? cls
                : `${cls}${w}`;
            if (tailSpace && isLast) {
              validatedClassNamesValue += whitespaces.at(-1) ?? "";
            }
          }
        }

        for (const issue of troubles) {
          if (originalClassNamesValue !== validatedClassNamesValue) {
            validatedClassNamesValue = prefix + validatedClassNamesValue + suffix;
            context.report({
              node,
              messageId: "shorthandCandidateDetected",
              data: {
                classnames: issue[0].join(", "),
                shorthand: issue[1],
              },
              fix(fixer) {
                if (start === null || end === null) {
                  return null;
                }
                return fixer.replaceTextRange([start, end], validatedClassNamesValue);
              },
            });
          }
        }
      });
    };

    return createClassnameVisitors({
      callees,
      tags,
      classRegex,
      skipClassAttribute,
      parseNode: parseForShorthandCandidates,
    });
  },
};

const isLR = (c: ParsedClassname) => c.shorthand === "l" || c.shorthand === "r";
const isTB = (c: ParsedClassname) => c.shorthand === "t" || c.shorthand === "b";

export default rule;
