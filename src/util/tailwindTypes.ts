import type { Config as TailwindConfig } from "tailwindcss";

export type TailwindTheme = NonNullable<TailwindConfig["theme"]>;

export type TailwindConfigInput = string | TailwindConfig;

export interface ResolvedTailwindConfig {
  prefix: string;
  theme: TailwindTheme;
  content?: {
    files?: string[];
  };
}
