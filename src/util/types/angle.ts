const units = ["deg", "grad", "rad", "turn"];

export const mergedAngleValues = [
  String.raw`\-?(\d{1,}(\.\d{1,})?|\.\d{1,})(${units.join("|")})`,
  String.raw`calc\(.{1,}\)`,
  String.raw`var\(\-\-[A-Za-z\-]{1,}\)`,
];
