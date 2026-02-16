import { uniq } from "es-toolkit";

// Units
const fontUnits = ["cap", "ch", "em", "ex", "ic", "lh", "rem", "rlh"];
const viewportUnits = ["vb", "vh", "vi", "vw", "vmin", "vmax"];
const absoluteUnits = ["px", "mm", "cm", "in", "pt", "pc"];
const perInchUnits = ["lin", "pt", "mm"];
const otherUnits = ["%"];
export const mergedUnits = uniq([
  ...fontUnits,
  ...viewportUnits,
  ...absoluteUnits,
  ...perInchUnits,
  ...otherUnits,
]);

// All units minus this blacklist
export const selectedUnits = mergedUnits.filter(
  el => !["cap", "ic", "vb", "vi"].includes(el)
);

const absoluteValues = [
  "0",
  String.raw`xx\-small`,
  String.raw`x\-small`,
  "small",
  "medium",
  "large",
  String.raw`x\-large`,
  String.raw`xx\-large`,
];
const relativeValues = ["larger", "smaller"];
const globalValues = ["inherit", "initial", "unset"];
export const mergedValues = [...absoluteValues, ...relativeValues, ...globalValues];

export const mergedLengthValues = [
  String.raw`\-?\d*\.?\d*(${mergedUnits.join("|")})`,
  ...mergedValues,
  String.raw`length\:var\(\-\-[a-z\-]{1,}\)`,
];

export const mergedUnitsRegEx = String.raw`\[(\d{1,}(\.\d{1,})?|(\.\d{1,})?)(${mergedUnits.join("|")})\]`;

export const selectedUnitsRegEx = String.raw`\[(\d{1,}(\.\d{1,})?|(\.\d{1,})?)(${selectedUnits.join("|")})\]`;

export const anyCalcRegEx = String.raw`\[calc\(.{1,}\)\]`;

export const validZeroRegEx = String.raw`^(0(\.0{1,})?|\.0{1,})(${mergedUnits.join("|")})?$`;
