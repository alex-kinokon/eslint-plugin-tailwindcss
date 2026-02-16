/**
 * @fileoverview Utilities used for grouping classnames
 */

// Ambiguous values
// ================
// Supported hints: length, color, angle, list
//
// border-[color/width]
// text-[color/size]
// ring-[color/width]
// ring-offset-[color/width]
// stroke-[current/width]
// bg-[color/(position/size)]
//
// font-[family/weight]

import type { GroupNode, GroupParentNode } from "../config/groups.ts";

import type { ResolvedTailwindConfig } from "./tailwindTypes.ts";
import { mergedAngleValues } from "./types/angle.ts";
import * as color from "./types/color.ts";
import * as length from "./types/length.ts";

type TailwindThemeScalar = string | number;

interface TailwindThemeScale {
  [key: string]: TailwindThemeScalar | TailwindThemeScale;
}

type GroupTailwindConfig = ResolvedTailwindConfig & {
  darkMode?: string | [string, string];
};

interface ParsedClassname {
  index: number | null;
  name: string;
  variants: string;
  parentType: string;
  body: string;
  value: string;
  shorthand: string;
  leading: string;
  trailing: string;
  important: boolean;
}

interface MatchedGroup extends GroupParentNode {
  group: string | null;
  value: string;
}

function isThemeScale(
  value: TailwindThemeScale | TailwindThemeScalar | null | undefined | object
): value is TailwindThemeScale {
  return typeof value === "object" && value !== null;
}

function getThemeScale(config: GroupTailwindConfig, prop: string): TailwindThemeScale {
  const theme = config.theme as
    | Record<string, TailwindThemeScale | TailwindThemeScalar | null | undefined>
    | undefined;
  const value = theme?.[prop];
  return isThemeScale(value) ? value : {};
}

/**
 * Escape special chars for regular expressions
 *
 * @param str Regular expression to be escaped
 * @returns Escaped version
 */
function escapeSpecialChars(str: string): string {
  return str.replace(/\W/g, String.raw`\$&`);
}

/**
 * Generates the opacity suffix based on config
 *
 * @param config Tailwind CSS Config
 * @returns The suffix or an empty string
 */
function generateOptionalOpacitySuffix(config: GroupTailwindConfig): string {
  const opacityKeys = !config.theme.opacity ? [] : Object.keys(config.theme.opacity);
  opacityKeys.push(String.raw`\[(\d*\.?\d*)%?\]`);
  return String.raw`(\/(${opacityKeys.join("|")}))?`;
}

const genericArbitraryOption = String.raw`\[(.*)\]`;
const genericScaleValue = String.raw`(\d{1,}(\.\d{1,})?|\.\d{1,}|\d{1,}\/\d{1,}|px|auto|full|min|max|fit|none|screen|inherit|initial|unset|xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl|svh|lvh|dvh|svw|lvw|dvw)`;
const genericShadeColorValue = String.raw`[a-z][a-z0-9]*(\-[a-z][a-z0-9]*)*\-(50|100|200|300|400|500|600|700|800|900|950)`;
const namedColors = color.cssNamedColors.map(c => escapeSpecialChars(c));
const genericColorValue = `(${namedColors.join("|")}|${genericShadeColorValue})`;

/**
 * Generate the possible options for the RegEx
 *
 * @param propName The name of the prop e.g. textColor
 * @param keys Keys to be injected in the options
 * @param config Tailwind CSS Config
 * @returns Generated part of regex exposing the possible values
 */
// eslint-disable-next-line complexity
function generateOptions(
  propName: string,
  keys: string[],
  config: GroupTailwindConfig
): string {
  const opacitySuffixes = generateOptionalOpacitySuffix(config);
  const defaultKeyIndex = keys.indexOf("DEFAULT");
  if (defaultKeyIndex !== -1) {
    keys.splice(defaultKeyIndex, 1);
  }
  const escapedKeys = keys.map(k => escapeSpecialChars(k));
  switch (propName) {
    case "dark":
      // Optional `dark` class
      if (config.darkMode === "class") {
        return "dark";
      } else if (Array.isArray(config.darkMode) && config.darkMode[0] === "class") {
        // https://tailwindcss.com/docs/dark-mode#customizing-the-class-name
        // For the sake of simplicity we only support a single class name
        let value = "";
        const res = /^\.(?<classnameValue>[\w:[\]-]*)$/.exec(config.darkMode[1]);
        if (res?.groups?.classnameValue) {
          value = res.groups.classnameValue;
        }
        return value;
      } else {
        return "";
      }
    case "arbitraryProperties":
      escapedKeys.push(genericArbitraryOption);
      return `(${escapedKeys.join("|")})`;
    case "colors":
    case "accentColor":
    case "borderColor":
    case "boxShadowColor":
    case "divideColor":
    case "fill":
    case "outlineColor":
    case "textColor":
    case "stroke":
    case "gradientColorStopPositions":
      // Colors can use segments like 'indigo' and 'indigo-light'
      // https://tailwindcss.com/docs/customizing-colors#color-object-syntax
      const options: string[] = [];
      const propThemeScale = getThemeScale(config, propName);
      const colorsThemeScale = getThemeScale(config, "colors");
      for (const k of keys) {
        if (!Object.hasOwn(propThemeScale, k) && !Object.hasOwn(colorsThemeScale, k)) {
          continue;
        }
        const colorValue = propThemeScale[k] ?? colorsThemeScale[k];
        if (typeof colorValue === "string" || typeof colorValue === "number") {
          options.push(escapeSpecialChars(k) + opacitySuffixes);
        } else if (isThemeScale(colorValue)) {
          const variants = Object.keys(colorValue).map(colorKey =>
            escapeSpecialChars(colorKey)
          );
          const defaultIndex = variants.indexOf("DEFAULT");
          const hasDefault = defaultIndex !== -1;
          if (hasDefault) {
            variants.splice(defaultIndex, 1);
          }
          options.push(
            k +
              String.raw`(\-(` +
              variants.join("|") +
              "))" +
              (hasDefault ? "?" : "") +
              opacitySuffixes
          );
        }
      }
      if (keys.length === 0) {
        options.push(`${genericColorValue}${opacitySuffixes}`);
      }
      if (propName === "fill" || propName === "stroke") {
        options.push("none");
      }
      const arbitraryColors = [...color.mergedColorValues];
      switch (propName) {
        case "fill":
          // Forbidden prefixes
          arbitraryColors.push(`(?!(angle|length|list):).{1,}`);
          break;
        case "gradientColorStopPositions":
          arbitraryColors.push(
            color.RGBAPercentages,
            color.optionalColorPrefixedVar,
            color.notHSLAPlusWildcard
          );
          break;
        case "textColor":
          arbitraryColors.push(color.RGBAPercentages, color.mandatoryColorPrefixed);
          break;
        default:
          arbitraryColors.push(color.mandatoryColorPrefixed);
      }
      options.push(String.raw`\[(${arbitraryColors.join("|")})\]`);
      return "(" + options.join("|") + ")";
    case "borderSpacing":
    case "borderWidth":
    case "divideWidth":
    case "fontSize":
    case "outlineWidth":
    case "outlineOffset":
    case "ringWidth":
    case "ringOffsetWidth":
    case "textUnderlineOffset":
      if (keys.length === 0) {
        escapedKeys.push(genericScaleValue);
      }
      escapedKeys.push(
        length.selectedUnitsRegEx,
        length.anyCalcRegEx,
        // Mandatory `length:` prefix + wildcard
        String.raw`\[length\:.{1,}\]`
      );
      return "(" + escapedKeys.join("|") + ")";
    case "strokeWidth":
      if (keys.length === 0) {
        escapedKeys.push(genericScaleValue);
      }
      escapedKeys.push(
        length.selectedUnitsRegEx,
        length.anyCalcRegEx,
        // Mandatory `length:` prefix + calc + wildcard
        String.raw`\[length\:calc\(.{1,}\)\]`,
        // Mandatory `length:` prefix + wildcard + optional units
        String.raw`\[length\:(.{1,})(${length.selectedUnits.join("|")})?\]`
      );
      return "(" + escapedKeys.join("|") + ")";
    case "gap":
    case "height":
    case "lineHeight":
    case "maxHeight":
    case "size":
    case "maxWidth":
    case "minHeight":
    case "minWidth":
    case "padding":
    case "width":
    case "blur":
    case "brightness":
    case "contrast":
    case "grayscale":
    case "invert":
    case "saturate":
    case "sepia":
    case "backdropBlur":
    case "backdropBrightness":
    case "backdropContrast":
    case "backdropGrayscale":
    case "backdropInvert":
    case "backdropOpacity":
    case "backdropSaturate":
    case "backdropSepia":
    case "transitionDuration":
    case "transitionTimingFunction":
    case "transitionDelay":
    case "animation":
    case "transformOrigin":
    case "scale":
    case "cursor":
      if (keys.length === 0) {
        escapedKeys.push(genericScaleValue);
      }
      // All units
      escapedKeys.push(
        length.mergedUnitsRegEx,
        String.raw`\[(?!(angle|color|length|list):).{1,}\]`
      );
      return "(" + escapedKeys.join("|") + ")";
    case "backdropHueRotate":
    case "hueRotate":
    case "inset":
    case "letterSpacing":
    case "margin":
    case "scrollMargin":
    case "skew":
    case "space":
    case "textIndent":
    case "translate":
      if (keys.length === 0) {
        escapedKeys.push(genericScaleValue);
      }
      // All units
      escapedKeys.push(
        length.mergedUnitsRegEx,
        String.raw`\[(?!(angle|color|length|list):).{1,}\]`
      );
      return "(" + escapedKeys.join("|") + ")";
    case "backgroundOpacity":
    case "borderOpacity":
    case "opacity":
    case "ringOpacity":
      // 0 ... .5 ... 1
      escapedKeys.push(
        String.raw`\[(0(\.\d{1,})?|\.\d{1,}|1)\]`,
        length.anyCalcRegEx,
        // Unprefixed var()
        String.raw`\[var\(\-\-[A-Za-z\-]{1,}\)\]`
      );
      return "(" + escapedKeys.join("|") + ")";
    case "rotate":
      escapedKeys.push(String.raw`\[(${mergedAngleValues.join("|")})\]`);
      return "(" + escapedKeys.join("|") + ")";
    case "gridTemplateColumns":
    case "gridColumn":
    case "gridColumnStart":
    case "gridColumnEnd":
    case "gridTemplateRows":
    case "gridRow":
    case "gridRowStart":
    case "gridRowEnd":
    case "gridAutoColumns":
    case "gridAutoRows":
      if (keys.length === 0) {
        escapedKeys.push(genericScaleValue, "subgrid");
      }
      // Forbidden prefixes
      escapedKeys.push(String.raw`\[(?!(angle|color|length):).{1,}\]`);
      return "(" + escapedKeys.join("|") + ")";
    case "listStyleType":
      // Forbidden prefixes
      escapedKeys.push(String.raw`\[(?!(angle|color|length|list):).{1,}\]`);
      return "(" + escapedKeys.join("|") + ")";
    case "objectPosition":
      // Forbidden prefixes
      escapedKeys.push(String.raw`\[(?!(angle|color|length):).{1,}\]`);
      return "(" + escapedKeys.join("|") + ")";
    case "backgroundPosition":
    case "boxShadow":
    case "dropShadow":
    case "transitionProperty":
      // Forbidden prefixes
      escapedKeys.push(String.raw`\[(?!((angle|color|length|list):)|#|var\().{1,}\]`);
      return "(" + escapedKeys.join("|") + ")";
    case "backgroundSize":
      // Forbidden prefixes
      escapedKeys.push(String.raw`\[length:.{1,}\]`);
      return "(" + escapedKeys.join("|") + ")";
    case "backgroundImageUrl":
      // Forbidden prefixes
      escapedKeys.push(`.{1,}`);
      return "(" + escapedKeys.join("|") + ")";
    case "backgroundImage":
      // Forbidden prefixes
      escapedKeys.push(String.raw`\[url\(.{1,}\)\]`);
      return "(" + escapedKeys.join("|") + ")";
    case "order":
      if (keys.length === 0) {
        escapedKeys.push(String.raw`(first|last|none|\d{1,})`);
      }
      escapedKeys.push(genericArbitraryOption);
      return "(" + escapedKeys.join("|") + ")";
    case "zIndex":
      if (keys.length === 0) {
        escapedKeys.push(String.raw`(auto|\d{1,})`);
      }
      escapedKeys.push(genericArbitraryOption);
      return "(" + escapedKeys.join("|") + ")";
    case "fontWeight":
    case "typography":
    case "lineClamp":
      // Cannot be arbitrary?
      if (keys.length === 0) {
        escapedKeys.push(genericScaleValue);
      }
      return "(" + escapedKeys.join("|") + ")";
    case "aspectRatio":
      if (!keys.includes("none")) {
        escapedKeys.push("none");
      }
      if (keys.length === 0) {
        escapedKeys.push(genericScaleValue);
      }
      escapedKeys.push(genericArbitraryOption);
      return "(" + escapedKeys.join("|") + ")";
    // case "flexGrow":
    // case "flexShrink":
    // case "fontFamily":
    // case "flex":
    // case "borderRadius":
    default:
      if (keys.length === 0) {
        escapedKeys.push(genericScaleValue);
      }
      escapedKeys.push(genericArbitraryOption);
      return "(" + escapedKeys.join("|") + ")";
  }
}

const cachedRegexes = new WeakMap<GroupTailwindConfig, Map<string, string>>();

/**
 * Customize the regex based on config
 *
 * @param re Regular expression
 * @param config The merged Tailwind CSS config
 * @returns Patched version with config values and additional parameters
 */
function patchRegex(re: string, config: GroupTailwindConfig): string {
  if (!cachedRegexes.has(config)) {
    cachedRegexes.set(config, new Map());
  }
  const cache = cachedRegexes.get(config);
  if (!cache) {
    return re;
  }
  if (cache.has(re)) {
    return cache.get(re)!;
  }
  let patched = String.raw`\!?`;
  // Prefix
  if (config.prefix.length) {
    patched += escapeSpecialChars(config.prefix);
  }
  // Props
  let replaced = re;
  const propsRe = /\${(-?[a-z]*)}/gi;
  const res = replaced.matchAll(propsRe);
  const resArray = [...res];
  const props = resArray.map(arr => arr[1]);
  if (props.length === 0) {
    const result = `${patched}(${replaced})`;
    cache.set(re, result);
    return result;
  }
  // e.g. backgroundColor, letterSpacing, -margin...
  for (const prop of props) {
    const token = new RegExp(String.raw`\$\{` + prop + String.raw`\}`);
    const isNegative = prop[0] === "-";
    const absoluteProp = isNegative ? prop.slice(1) : prop;
    switch (prop) {
      case "dark": {
        // Special case, not a default property from the theme
        replaced = replaced.replace(token, generateOptions(absoluteProp, [], config));
        continue;
      }
      case "arbitraryProperties": {
        // Special case
        replaced = replaced.replace(
          new RegExp(String.raw`\$\{` + absoluteProp + String.raw`\}`),
          generateOptions(absoluteProp, [], config)
        );
        continue;
      }
      case "backgroundImageUrl": {
        // Special case
        replaced = replaced.replace(
          new RegExp(String.raw`\$\{` + prop + String.raw`\}`),
          generateOptions(prop, [], config)
        );
        continue;
      }
      default:
        if (Object.keys(getThemeScale(config, absoluteProp)).length === 0) {
          // Tailwind v4 design-system configs may not expose a legacy theme map.
          // Fall back to generic option patterns instead of leaving tokens unresolved.
          replaced = replaced.replace(token, generateOptions(absoluteProp, [], config));
          continue;
        }
    }
    const propThemeScale = getThemeScale(config, absoluteProp);
    // Normal scenario
    const keys = Object.keys(propThemeScale)
      .filter(key => {
        if (isNegative) {
          // Negative prop cannot support NaN values and inherits positive values
          const val = propThemeScale[key];
          const isCalc = typeof val === "string" && val.startsWith("calc");
          const num =
            typeof val === "number" || typeof val === "string"
              ? Number.parseFloat(String(val))
              : Number.NaN;
          if (isCalc) {
            return true;
          }
          if (isNaN(num)) {
            return false;
          }
        } else if (key[0] === "-") {
          // Positive prop cannot use key starting with '-'
          return false;
        }
        return true;
      })
      .map(key => (isNegative && key[0] === "-" ? key.slice(1) : key));
    if (keys.length === 0 || replaced.match(token) === null) {
      // empty array
      continue;
    }
    const opts = generateOptions(absoluteProp, keys, config);
    replaced = replaced.replace(token, opts);
  }
  const result = `${patched}(${replaced})`;
  cache.set(re, result);
  return result;
}

/**
 * Generates a flatten array from the groups config
 *
 * @param groupsConfig The array of objects containing the regex
 * @param twConfig The merged config of Tailwind CSS
 * @returns Flatten array
 */
export function getGroups(
  groupsConfig: GroupNode[],
  twConfig: GroupTailwindConfig | null = null
): string[] {
  const groups: string[] = [];
  for (const group of groupsConfig) {
    const { members: groupMembers } = group;
    if (typeof groupMembers === "string") {
      groups.push(groupMembers);
      continue;
    }
    // e.g. SIZING or SPACING
    for (const { members: propMembers } of groupMembers) {
      // e.g. Width or Padding
      if (typeof propMembers === "string") {
        // Unique property, like `width` limited to one value
        groups.push(propMembers);
      } else {
        // Multiple properties, like `padding`, `padding-top`...
        for (const { members } of propMembers) {
          if (typeof members === "string") {
            groups.push(members);
          }
        }
      }
    }
  }
  if (twConfig === null) {
    return groups;
  }
  return groups.map(re => patchRegex(re, twConfig));
}

/**
 * Searches for a match between classname and Tailwind CSS group
 *
 * @param name The target classname
 * @param arr The flatten array containing the regex
 * @returns Array of empty arrays
 */
export function getGroupIndex(name: string, arr: string[]): number {
  const classSuffix = getSuffix(name);
  return arr.findIndex(pattern => new RegExp(`^(${pattern})$`).test(classSuffix));
}

/**
 * Generates a flatten array from the groups configKeys
 *
 * @param groupsConfig The array of objects containing the regex
 * @param twConfig The merged config of Tailwind CSS
 * @returns Flatten array
 */
export function getGroupConfigKeys(groupsConfig: GroupNode[]): Array<string | null> {
  const groups: Array<string | null> = [];
  for (const { members, configKey } of groupsConfig) {
    if (typeof members === "string") {
      groups.push(configKey ?? null);
      continue;
    }
    // e.g. SIZING or SPACING
    for (const { members: propMembers, configKey } of members) {
      // e.g. Width or Padding
      if (typeof propMembers === "string") {
        // Unique property, like `width` limited to one value
        groups.push(configKey ?? null);
      } else {
        // Multiple properties, like `padding`, `padding-top`...
        for (const { configKey } of propMembers) {
          groups.push(configKey ?? null);
        }
      }
    }
  }
  return groups;
}

/**
 * Returns the prefix (variants) of a className including the separator or an empty string if none
 *
 * @param name Classname to be parsed
 * @returns The prefix
 */
export function getPrefix(name: string): string {
  // eslint-disable-next-line regexp/no-unused-capturing-group
  const rootSeparatorRegex = /(?<!\[[\da-z-]*)(:)(?![\da-z-]*])/;
  let classname = name;
  let index = 0;
  let results: RegExpExecArray | undefined | null;
  while ((results = rootSeparatorRegex.exec(classname)) !== null) {
    const newIndex = results.index + 1;
    index += newIndex;
    classname = classname.slice(Math.max(0, newIndex));
  }

  return index ? name.slice(0, Math.max(0, index)) : "";
}

/**
 * Returns the arbitrary property of className without the separator or an empty string if none
 * e.g. "[mask-type:luminance]" => "mask-type"
 *
 * @see https://tailwindcss.com/docs/adding-custom-styles#arbitrary-properties
 * @param name Classname suffix (without it variants) to be parsed
 * @returns The arbitrary property
 */
export function getArbitraryProperty(name: string): string {
  return /^\[([a-z-]*):\.*/.exec(name)?.[1] ?? "";
}

/**
 * Get the last part of the full classname
 * e.g. "lg:w-[100px]" => "w-[100px]"
 *
 * @param className The target classname
 * @returns The classname without its variants
 */
export function getSuffix(className: string): string {
  return className.slice(getPrefix(className).length);
}

/**
 * Find the group of a classname
 *
 * @param name Classname to be find using patterns (without modifiers)
 * @param group The group being tested
 * @param config Tailwind CSS config
 * @param parentType The name of the parent group
 * @returns The infos
 */
function findInGroup(
  name: string,
  group: GroupNode,
  config: GroupTailwindConfig,
  parentType: string | null = null
): MatchedGroup | null {
  const members = group.members as GroupParentNode[];
  if (typeof members === "string") {
    const pattern = patchRegex(members, config);
    const classRe = new RegExp(`^(${pattern})$`);
    if (classRe.test(name)) {
      const res = classRe.exec(name);
      let value = "";
      if (res?.groups) {
        if (res.groups.value) {
          value = res.groups.value;
        }
        if (res.groups.negativeValue) {
          value = "-" + res.groups.negativeValue;
        }
      }

      return {
        group: parentType,
        type: group.type,
        members,
        configKey: group.configKey,
        shorthand: group.shorthand,
        body: group.body,
        deprecated: group.deprecated,
        value,
      };
    } else {
      return null;
    }
  }

  for (const child of members) {
    const found = findInGroup(name, child, config, group.type);
    if (found) {
      return found;
    }
  }
  return null;
}

/**
 * Returns an object with parsed properties
 *
 * @param name Classname to be parsed
 * @param arr The flatten array containing the regex
 * @param config The Tailwind CSS config
 * @param index The index
 * @returns Parsed infos
 */
export function parseClassname(
  name: string,
  arr: GroupNode[],
  config: GroupTailwindConfig,
  index: number | null = null
): ParsedClassname {
  const leadingRe = /^(?<leading>\s*)/;
  const trailingRe = /(?<trailing>\s*)$/;
  let leading = "";
  let core = "";
  let trailing = "";
  const leadingRes = leadingRe.exec(name);
  if (leadingRes?.groups) {
    leading = leadingRes.groups.leading || "";
  }
  const trailingRes = trailingRe.exec(name);
  if (trailingRes?.groups) {
    trailing = trailingRes.groups.trailing || "";
  }
  // eslint-disable-next-line unicorn/prefer-string-slice
  core = name.substring(leading.length, name.length - trailing.length);
  const variants = getPrefix(core);
  const classSuffix = getSuffix(core);
  let slot: MatchedGroup | null = null;
  for (const group of arr) {
    if (slot === null) {
      const found = findInGroup(classSuffix, group, config);
      if (found) {
        slot = found;
      }
    }
  }

  const value = slot?.value ?? "";
  const off = value.startsWith("-") ? 1 : 0;
  const body = core
    .slice(0, Math.max(0, core.length - value.length + off))
    .slice(variants.length + off);

  return {
    index,
    name: core,
    variants,
    parentType: slot?.group ?? "",
    body,
    value,
    shorthand: slot && slot.shorthand ? slot.shorthand : "",
    leading,
    trailing,
    important: body.startsWith("!"),
  };
}
