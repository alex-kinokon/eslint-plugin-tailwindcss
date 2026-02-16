/**
 * @fileoverview Use a consistent orders for the Tailwind CSS classnames, based on property then on variants
 * @author François Massart
 */
import assert from "node:assert";

import { describe, it } from "vitest";

import { plugin } from "../src/index.ts";

describe("configurations", () => {
  it(`should export a "flat/recommended" configuration`, () => {
    assert(plugin.configs!["flat/recommended"]);
  });
});
