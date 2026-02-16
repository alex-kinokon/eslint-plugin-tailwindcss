/* eslint-disable unicorn/string-content */
/* eslint-disable unicorn/better-regex */
// MIT License
// Copyright (c) 2022 Stephen Zhou <https://github.com/hyoban>

import fs, { promises as fsp } from "node:fs";
import path, { dirname, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import EnhancedResolve from "enhanced-resolve";
import * as tailwindMod from "tailwindcss";
import type { Config as TailwindConfig } from "tailwindcss";

import type {
  ResolvedTailwindConfig,
  TailwindConfigInput,
  TailwindTheme,
} from "./util/tailwindTypes.ts";
import { createRequire } from "node:module";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObject = Record<string, any>;

interface DesignSystem {
  getClassOrder: (classes: string[]) => Array<[string, bigint | null]>;
  candidatesToCss: (classes: string[]) => Array<string | null>;
  tailwindConfig?: Partial<ResolvedTailwindConfig>;
}

interface LoadDesignSystemOptions {
  base?: string;
  loadModule: (
    id: string,
    base: string,
    resourceHint: "plugin" | "config"
  ) => Promise<{ path: string; base: string; module: unknown }>;
  loadStylesheet: (
    id: string,
    base: string
  ) => Promise<{ path: string; base: string; content: string }>;
}

function isRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeTheme(
  defaultTheme: AnyObject,
  inlineTheme: AnyObject | undefined
): AnyObject {
  const merged: AnyObject = { ...defaultTheme };
  if (!isRecord(inlineTheme)) {
    return merged;
  }

  for (const [key, value] of Object.entries(inlineTheme!)) {
    if (key === "extend") {
      continue;
    }
    merged[key] =
      isRecord(value) && isRecord(merged[key]) ? { ...merged[key], ...value } : value;
  }

  const extend = inlineTheme!.extend;
  if (isRecord(extend)) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    for (const [key, value] of Object.entries(extend) as Array<[string, object]>) {
      if (typeof merged[key] === "function" && isRecord(value)) {
        const baseFn = merged[key] as (input: {
          theme: (name: string, defaultValue?: unknown) => unknown;
        }) => object;
        merged[key] = (input: {
          theme: (name: string, defaultValue?: unknown) => unknown;
        }) => {
          const baseValue = baseFn(input);
          return isRecord(baseValue) ? { ...baseValue, ...value } : { ...value };
        };
        continue;
      }
      merged[key] =
        isRecord(value) && isRecord(merged[key]) ? { ...merged[key], ...value } : value;
    }
  }

  return merged;
}

function toCloneSafeTheme<T>(theme: T): T {
  return JSON.parse(
    JSON.stringify(theme, (_key, value) =>
      typeof value === "function" ? undefined : value
    )
  ) as T;
}

function resolveThemeFunctions(theme: AnyObject): AnyObject {
  const resolved: AnyObject = {};
  const resolving = new Set<string>();

  const resolveKey = (key: string): any => {
    if (Object.hasOwn(resolved, key)) {
      return resolved[key];
    }
    if (resolving.has(key)) {
      return;
    }
    resolving.add(key);

    const rawValue = theme[key];
    let value: unknown = rawValue;
    if (typeof rawValue === "function") {
      try {
        value = (
          rawValue as (input: {
            theme: (name: string, defaultValue?: unknown) => unknown;
          }) => unknown
        )({
          theme: (name: string, defaultValue?: unknown) => {
            const parts = name.split(".");
            if (!parts[0]) {
              return defaultValue;
            }
            let current = resolveKey(parts[0]);
            for (const part of parts.slice(1)) {
              if (!isRecord(current)) {
                current = undefined;
                break;
              }
              current = current[part];
            }
            return current === undefined ? defaultValue : current;
          },
        });
      } catch {
        value = undefined;
      }
    }

    resolving.delete(key);
    resolved[key] = value;
    return value;
  };

  for (const key of Object.keys(theme)) {
    resolveKey(key);
  }

  return resolved;
}

type PatternSource = string | RegExp | PatternSource[];
const REGEX_SPECIAL = /[\\^$.*+?()[\]{}|]/g;
const REGEX_HAS_SPECIAL = new RegExp(REGEX_SPECIAL.source);
function toSource(source: PatternSource): string {
  source = Array.isArray(source) ? source : [source];
  source = source.map(item => (item instanceof RegExp ? item.source : item));
  return source.join("");
}
function pattern(source: PatternSource): RegExp {
  return new RegExp(toSource(source), "g");
}
function any(sources: PatternSource[]): string {
  return `(?:${sources.map(toSource).join("|")})`;
}
function optional(source: PatternSource): string {
  return `(?:${toSource(source)})?`;
}
function escape(string: string): string {
  return string && REGEX_HAS_SPECIAL.test(string)
    ? string.replace(REGEX_SPECIAL, String.raw`\$&`)
    : string || "";
}

function splitAtTopLevelOnly(input: string): string[] {
  const stack: string[] = [];
  const parts: string[] = [];
  let lastPos = 0;
  let isEscaped = false;
  for (let idx = 0; idx < input.length; idx++) {
    const char = input[idx];
    if (stack.length === 0 && char === "." && !isEscaped) {
      parts.push(input.slice(lastPos, idx));
      lastPos = idx + 1;
    }
    isEscaped = isEscaped ? false : char === "\\";
    if (char === "(" || char === "[" || char === "{") {
      stack.push(char);
    } else if (
      (char === ")" && stack.at(-1) === "(") ||
      (char === "]" && stack.at(-1) === "[") ||
      (char === "}" && stack.at(-1) === "{")
    ) {
      stack.pop();
    }
  }
  parts.push(input.slice(lastPos));
  return parts;
}

interface ExtractorContext {
  tailwindConfig: {
    prefix: string;
  };
}
function defaultExtractor(context: ExtractorContext): (content: string) => string[] {
  const patterns = Array.from(buildRegExps(context));
  return (content: string) => {
    const results: string[] = [];
    for (const pattern2 of patterns) {
      for (const result of content.match(pattern2) ?? []) {
        results.push(clipAtBalancedParens(result));
      }
    }
    for (const result of results.slice()) {
      const segments = splitAtTopLevelOnly(result);
      for (let idx = 0; idx < segments.length; idx++) {
        const segment = segments[idx];
        if (idx >= segments.length - 1) {
          results.push(segment);
          continue;
        }
        const next = Number(segments[idx + 1]);
        if (Number.isNaN(next)) {
          results.push(segment);
        } else {
          idx++;
        }
      }
    }
    return results;
  };
}

const SPECIALS = /([[\]'"`])([^[\]'"`])?/g;
const ALLOWED_CLASS_CHARACTERS = /[^"'`\s<>\]]+/;
type MatchWithIndex = RegExpMatchArray & {
  index: number;
  0: string | undefined;
};
function clipAtBalancedParens(input: string): string {
  if (!input.includes("-[")) {
    return input;
  }
  let depth = 0;
  const openStringTypes: string[] = [];
  const matches: MatchWithIndex[] = Array.from(input.matchAll(SPECIALS)).flatMap(
    match => {
      const [, ...groups] = match;
      return groups.map(
        (group, idx) =>
          Object.assign([], match, {
            index: match.index + idx,
            0: group,
          }) as MatchWithIndex
      );
    }
  );
  for (const match of matches) {
    const char = match[0];
    if (!char) continue;
    const inStringType = openStringTypes.at(-1);
    if (char === inStringType) {
      openStringTypes.pop();
    } else if (char === "'" || char === '"' || char === "`") {
      openStringTypes.push(char);
    }
    if (inStringType) {
      continue;
    } else if (char === "[") {
      depth++;
      continue;
    } else if (char === "]") {
      depth--;
      continue;
    }
    if (depth < 0) {
      return input.slice(0, Math.max(0, match.index - 1));
    }
    if (depth === 0 && !ALLOWED_CLASS_CHARACTERS.test(char)) {
      return input.slice(0, Math.max(0, match.index));
    }
  }
  return input;
}

const DEPENDENCY_PATTERNS: RegExp[] = [
  /import[\s\S]*?['"](.{3,}?)['"]/gi,
  /import[\s\S]*from[\s\S]*?['"](.{3,}?)['"]/gi,
  /export[\s\S]*from[\s\S]*?['"](.{3,}?)['"]/gi,
  /require\(['"`](.+)['"`]\)/gi,
];
const JS_EXTENSIONS = /* @__PURE__ */ new Set([".js", ".cjs", ".mjs"]);
const JS_RESOLUTION_ORDER = [
  "",
  ".js",
  ".cjs",
  ".mjs",
  ".ts",
  ".cts",
  ".mts",
  ".jsx",
  ".tsx",
];
const TS_RESOLUTION_ORDER = [
  "",
  ".ts",
  ".cts",
  ".mts",
  ".tsx",
  ".js",
  ".cjs",
  ".mjs",
  ".jsx",
];
async function resolveWithExtension(
  file: string,
  extensions: string[]
): Promise<string | null> {
  for (const ext of extensions) {
    const full = `${file}${ext}`;
    const stats = await fsp.stat(full).catch(() => null);
    if (stats?.isFile()) return full;
  }
  for (const ext of extensions) {
    const full = `${file}/index${ext}`;
    const exists = await fsp.access(full).then(
      () => true,
      () => false
    );
    if (exists) {
      return full;
    }
  }
  return null;
}
async function traceDependencies(
  seen: Set<string>,
  filename: string,
  base: string,
  ext: string
): Promise<void> {
  const extensions = JS_EXTENSIONS.has(ext) ? JS_RESOLUTION_ORDER : TS_RESOLUTION_ORDER;
  const absoluteFile = await resolveWithExtension(resolve(base, filename), extensions);
  if (absoluteFile === null) return;
  if (seen.has(absoluteFile)) return;
  seen.add(absoluteFile);
  base = dirname(absoluteFile);
  ext = extname(absoluteFile);
  const contents = await fsp.readFile(absoluteFile, "utf-8");
  const promises: Array<Promise<void>> = [];
  for (const pattern2 of DEPENDENCY_PATTERNS) {
    for (const match of contents.matchAll(pattern2)) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!match[1]?.startsWith(".")) continue;
      promises.push(traceDependencies(seen, match[1], base, ext));
    }
  }
  await Promise.all(promises);
}
async function getModuleDependencies(absoluteFilePath: string): Promise<string[]> {
  const seen = /* @__PURE__ */ new Set<string>();
  await traceDependencies(
    seen,
    absoluteFilePath,
    dirname(absoluteFilePath),
    extname(absoluteFilePath)
  );
  return Array.from(seen);
}

const fileSystem = new EnhancedResolve.CachedInputFileSystem(fs, 4e3);
// eslint-disable-next-line import-x/no-named-as-default-member
const cssResolver = EnhancedResolve.ResolverFactory.createResolver({
  fileSystem,
  useSyncFileSystemCalls: true,
  extensions: [".css"],
  mainFields: ["style"],
  conditionNames: ["style"],
});
// eslint-disable-next-line import-x/no-named-as-default-member
const esmResolver = EnhancedResolve.ResolverFactory.createResolver({
  fileSystem,
  useSyncFileSystemCalls: true,
  extensions: [".js", ".json", ".node", ".ts"],
  conditionNames: ["node", "import"],
});
// eslint-disable-next-line import-x/no-named-as-default-member
const cjsResolver = EnhancedResolve.ResolverFactory.createResolver({
  fileSystem,
  useSyncFileSystemCalls: true,
  extensions: [".js", ".json", ".node", ".ts"],
  conditionNames: ["node", "require"],
});

async function resolveJsId(
  id: string,
  base: string
): Promise<string | false | undefined> {
  try {
    return await runResolver(esmResolver, id, base);
  } catch {
    return await runResolver(cjsResolver, id, base);
  }
}

function runResolver(
  resolver: EnhancedResolve.Resolver,
  id: string,
  base: string
): Promise<string | false | undefined> {
  return new Promise((resolve, reject) =>
    resolver.resolve({}, base, id, {}, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    })
  );
}

export class TailwindUtils {
  context: DesignSystem | null = null;
  extractor: ((content: string) => string[]) | null = null;

  async loadConfig(
    configPathOrContent: TailwindConfigInput | null,
    pwd: string
  ): Promise<void> {
    const { __unstable__loadDesignSystem } = tailwindMod as unknown as {
      __unstable__loadDesignSystem: (
        css: string,
        options: LoadDesignSystemOptions
      ) => Promise<DesignSystem>;
    };
    const require = createRequire(import.meta.dirname);

    const defaultCSSThemePath = require.resolve("tailwindcss/theme.css");
    if (!defaultCSSThemePath) throw new Error("Could not resolve tailwindcss theme");
    const defaultCSSTheme = await fsp.readFile(defaultCSSThemePath, "utf-8");
    const css =
      typeof configPathOrContent === "string"
        ? await fsp.readFile(configPathOrContent, "utf-8")
        : "";

    this.context = await __unstable__loadDesignSystem(`${defaultCSSTheme}\n${css}`, {
      base: pwd,
      async loadModule(id, base) {
        if (id[0] !== ".") {
          const resolvedPath = await resolveJsId(id, base);
          if (!resolvedPath) {
            throw new Error(`Could not resolve '${id}' from '${base}'`);
          }
          const module = await import(pathToFileURL(resolvedPath).href);
          return {
            path: resolvedPath,
            base: dirname(resolvedPath),
            module: module.default ?? module,
          };
        }

        const resolvedPath = await resolveJsId(id, base);
        if (!resolvedPath) {
          throw new Error(`Could not resolve '${id}' from '${base}'`);
        }
        const [module, _moduleDependencies] = await Promise.all([
          import(`${pathToFileURL(resolvedPath).href}?id=${Date.now()}`),
          getModuleDependencies(resolvedPath),
        ]);
        return {
          path: resolvedPath,
          base: dirname(resolvedPath),
          module: module.default ?? module,
        };
      },

      async loadStylesheet(id: string, base: string) {
        const resolvedPath = await runResolver(cssResolver, id, base);
        if (!resolvedPath) throw new Error(`Could not resolve '${id}' from '${base}'`);
        const file = await fsp.readFile(resolvedPath, "utf-8");
        return {
          path: resolvedPath,
          base: path.dirname(resolvedPath),
          content: file,
        };
      },
    });

    const inlineConfig: TailwindConfig =
      typeof configPathOrContent === "object" && configPathOrContent !== null
        ? configPathOrContent
        : {};

    const defaultThemePath = require.resolve("tailwindcss/defaultTheme");
    let defaultTheme: TailwindTheme = {};
    if (defaultThemePath) {
      const defaultThemeMod = await import(pathToFileURL(defaultThemePath).href);
      defaultTheme = (defaultThemeMod.default ?? defaultThemeMod) as TailwindTheme;
    }
    const mergedTheme: TailwindTheme = toCloneSafeTheme(
      resolveThemeFunctions(mergeTheme(defaultTheme, inlineConfig.theme))
    );
    const extractorContext: ExtractorContext = {
      tailwindConfig: {
        prefix: inlineConfig.prefix ?? "",
      },
    };
    this.context.tailwindConfig = {
      ...extractorContext.tailwindConfig,
      theme: mergedTheme,
    };
    this.extractor = defaultExtractor(extractorContext);
  }

  isValidClassName(className: string): boolean;
  isValidClassName(className: string[]): boolean[];
  isValidClassName(className: string | string[]): boolean | boolean[] {
    const input = Array.isArray(className) ? className : [className];
    const res = this.context?.getClassOrder(input);
    if (!res) {
      throw new Error("Failed to get class order");
    }
    return Array.isArray(className) ? res.map(r => r[1] !== null) : res[0][1] !== null;
  }

  getSortedClassNames(className: string[]): string[] {
    const res = this.context?.getClassOrder(className);
    if (!res) {
      throw new Error("Failed to get class order");
    }
    return res
      .sort(([nameA, a], [nameZ, z]) => {
        if (nameA === "..." || nameA === "\u2026") return 1;
        if (nameZ === "..." || nameZ === "\u2026") return -1;
        if (a === z) return 0;
        if (a === null) return -1;
        if (z === null) return 1;
        return bigSign(a - z);
      })
      .map(([name]) => name);
  }

  extract(content: string): string[] {
    if (!this.extractor) {
      throw new Error("Extractor is not available");
    }
    return this.extractor(content);
  }
}

function bigSign(bigIntValue: bigint): number {
  return Number(bigIntValue > 0n) - Number(bigIntValue < 0n);
}

function* buildRegExps(context: ExtractorContext): Generator<RegExp, void, unknown> {
  const DOT = ":";
  const prefix =
    context.tailwindConfig.prefix !== ""
      ? optional(pattern([/-?/, escape(context.tailwindConfig.prefix)]))
      : "";
  const utility = any([
    // Arbitrary properties (without square brackets)
    /\[[^\s:'"`]+:[^\s[\]]+\]/,
    // Arbitrary properties with balanced square brackets
    // This is a targeted fix to continue to allow theme()
    // with square brackets to work in arbitrary properties
    // while fixing a problem with the regex matching too much
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    /\[[^\s:'"`\]]+:\S+?\[\S+\]\S+?\]/,
    // Utilities
    pattern([
      // Utility Name / Group Name
      any([
        /-?\w+/,
        // This is here to make sure @container supports everything that other utilities do
        /@\w+/,
      ]),
      // Normal/Arbitrary values
      optional(
        any([
          pattern([
            // Arbitrary values
            any([
              /-(?:\w+-)*\['\S+'\]/,
              /-(?:\w+-)*\["\S+"\]/,
              /-(?:\w+-)*\[`\S+`\]/,
              /-(?:\w+-)*\[(?:[^\s[\]]+\[[^\s[\]]+\])*[^\s:[\]]+\]/,
            ]),
            // Not immediately followed by an `{[(`
            /(?![{([]\])/,
            // optionally followed by an opacity modifier
            /(?:\/[^\s'"`\\><$]*)?/,
          ]),
          pattern([
            // Arbitrary values
            any([
              /-(?:\w+-)*\['\S+'\]/,
              /-(?:\w+-)*\["\S+"\]/,
              /-(?:\w+-)*\[`\S+`\]/,
              /-(?:\w+-)*\[(?:[^\s[\]]+\[[^\s[\]]+\])*[^\s[\]]+\]/,
            ]),
            // Not immediately followed by an `{[(`
            /(?![{([]\])/,
            // optionally followed by an opacity modifier
            /(?:\/[^\s'"`\\$]*)?/,
          ]),
          // Normal values w/o quotes may include an opacity modifier
          /[-/][^\s'"`\\$={><]*/,
        ])
      ),
    ]),
  ]);
  const variantPatterns = [
    // Without quotes
    any([
      // This is here to provide special support for the `@` variant
      pattern([/@\[[^\s"'`]+\](\/[^\s"'`]+)?/, DOT]),
      // With variant modifier (e.g.: group-[..]/modifier)
      pattern([/([^\s"'`[\\]+-)?\[[^\s"'`]+\]\/[\w-]+/, DOT]),
      pattern([/([^\s"'`[\\]+-)?\[[^\s"'`]+\]/, DOT]),
      pattern([/[^\s"'`[\\]+/, DOT]),
    ]),
    // With quotes allowed
    any([
      // With variant modifier (e.g.: group-[..]/modifier)
      pattern([/([^\s"'`[\\]+-)?\[[^\s`]+\]\/[\w-]+/, DOT]),
      pattern([/([^\s"'`[\\]+-)?\[[^\s`]+\]/, DOT]),
      pattern([/[^\s`[\\]+/, DOT]),
    ]),
  ];
  for (const variantPattern of variantPatterns) {
    yield pattern([
      // Variants
      "((?=((",
      variantPattern,
      String.raw`)+))\2)?`,
      // Important (optional)
      /!?/,
      prefix,
      utility,
    ]);
  }
  yield /[^<>"'`\s.(){}[\]#=%$][^<>"'`\s(){}[\]#=%$]*[^<>"'`\s.(){}[\]#=%:$]/g;
}
