/**
 * @fileoverview Test groupMethods utilities
 * @author François Massart
 */

import assert from "node:assert";

import { describe, it } from "vitest";

import { groups as defaultGroups } from "../../src/config/groups.ts";
import * as groupUtil from "../../src/util/groupMethods.ts";
import { getTailwindConfig } from "../../src/util/tailwindAPI.ts";

const mergedConfig = getTailwindConfig({});

describe("getPrefix", () => {
  it("should retrieve the correct prefix", () => {
    assert.equal(
      groupUtil.getPrefix("dark:[hidden]:lg:text-[color:var(--my-var,#ccc)]"),
      "dark:[hidden]:lg:"
    );

    assert.equal(groupUtil.getPrefix("text-[color:var(--my-var,#ccc)]"), "");
  });
});

describe("getSuffix", () => {
  it("should retrieve the correct suffix", () => {
    assert.equal(
      groupUtil.getSuffix("dark:[hidden]:lg:text-[color:var(--my-var,#ccc)]"),
      "text-[color:var(--my-var,#ccc)]"
    );
    assert.equal(
      groupUtil.getSuffix("text-[color:var(--my-var,#ccc)]"),
      "text-[color:var(--my-var,#ccc)]"
    );
  });
});

describe("parseClassname", () => {
  const targetProperties = {
    Layout: ["Overflow", "Overscroll Behavior", "Top / Right / Bottom / Left"],
    "Flexbox & Grid": ["Gap"],
    Spacing: ["Padding", "Margin"],
    Borders: ["Border Radius", "Border Width", "Border Color"],
    Tables: ["Border Spacing"],
    Transforms: ["Scale"],
  };
  const targetGroups = defaultGroups.filter(g =>
    Object.keys(targetProperties).includes(g.type)
  );

  it("should have filtered `targetGroups`", () => {
    assert.equal(targetGroups.length, Object.keys(targetProperties).length);
  });

  it(`should parse classnames`, () => {
    const name = "overflow-x-auto";
    const actual = groupUtil.parseClassname(name, targetGroups, mergedConfig, 0);
    const expected = {
      index: 0,
      name,
      variants: "",
      parentType: "Overflow",
      body: "overflow-x-",
      value: "auto",
      shorthand: "x",
      leading: "",
      trailing: "",
      important: false,
    };
    assert.deepEqual(actual, expected);

    {
      const name = "md:overflow-y-auto";
      const actual = groupUtil.parseClassname(name, targetGroups, mergedConfig, 1);
      expected.index = 1;
      expected.name = name;
      expected.body = "overflow-y-";
      expected.shorthand = "y";
      expected.variants = "md:";
      assert.deepEqual(actual, expected);
    }

    {
      const name = "lg:dark:overflow-auto";
      const actual = groupUtil.parseClassname(name, targetGroups, mergedConfig, 2);
      expected.index = 2;
      expected.name = name;
      expected.body = "overflow-";
      expected.shorthand = "all";
      expected.variants = "lg:dark:";
      assert.deepEqual(actual, expected);
    }

    {
      const name = "sm:dark:overscroll-x-none";
      const actual = groupUtil.parseClassname(name, targetGroups, mergedConfig, 3);
      expected.index = 3;
      expected.name = name;
      expected.shorthand = "x";
      expected.variants = "sm:dark:";
      expected.parentType = "Overscroll Behavior";
      expected.body = "overscroll-x-";
      expected.value = "none";
      assert.deepEqual(actual, expected);
    }

    {
      const name = "inset-0";
      const actual = groupUtil.parseClassname(name, targetGroups, mergedConfig, 4);
      expected.index = 4;
      expected.name = name;
      expected.shorthand = "all";
      expected.variants = "";
      expected.parentType = "Top / Right / Bottom / Left";
      expected.body = "inset-";
      expected.value = "0";
      assert.deepEqual(actual, expected);
    }

    {
      const name = "sm:-inset-x-1";
      const actual = groupUtil.parseClassname(name, targetGroups, mergedConfig, 5);
      expected.index = 5;
      expected.name = name;
      expected.shorthand = "x";
      expected.variants = "sm:";
      expected.body = "inset-x-";
      expected.value = "-1";
      assert.deepEqual(actual, expected);
    }

    {
      const name = "sm:-inset-x-1";
      const actual = groupUtil.parseClassname(name, targetGroups, mergedConfig, 6);
      expected.index = 6;
      expected.name = name;
      expected.shorthand = "x";
      expected.variants = "sm:";
      expected.body = "inset-x-";
      expected.value = "-1";
      assert.deepEqual(actual, expected);
    }

    {
      const name = "gap-px";
      const actual = groupUtil.parseClassname(name, targetGroups, mergedConfig, 7);
      expected.index = 7;
      expected.name = name;
      expected.shorthand = "all";
      expected.variants = "";
      expected.parentType = "Gap";
      expected.body = "gap-";
      expected.value = "px";
      assert.deepEqual(actual, expected);
    }

    {
      const name = "p-5";
      const actual = groupUtil.parseClassname(name, targetGroups, mergedConfig, 8);
      expected.index = 8;
      expected.name = name;
      expected.shorthand = "all";
      expected.variants = "";
      expected.parentType = "Padding";
      expected.body = "p-";
      expected.value = "5";
      assert.deepEqual(actual, expected);
    }

    {
      const name = "-my-px";
      const actual = groupUtil.parseClassname(name, targetGroups, mergedConfig, 9);
      expected.index = 9;
      expected.name = name;
      expected.shorthand = "y";
      expected.variants = "";
      expected.parentType = "Margin";
      expected.body = "my-";
      expected.value = "-px";
      assert.deepEqual(actual, expected);
    }

    {
      // "Border Radius"
      const name = "rounded-tl-lg";
      const actual = groupUtil.parseClassname(name, targetGroups, mergedConfig, 13);
      expected.index = 13;
      expected.name = name;
      expected.shorthand = "tl";
      expected.variants = "";
      expected.parentType = "Border Radius";
      expected.body = "rounded-tl-";
      expected.value = "lg";
      assert.deepEqual(actual, expected);
    }

    {
      // "Border Width"
      const name = "border-t-4";
      const actual = groupUtil.parseClassname(name, targetGroups, mergedConfig, 14);
      expected.index = 14;
      expected.name = name;
      expected.shorthand = "t";
      expected.variants = "";
      expected.parentType = "Border Width";
      expected.body = "border-t-";
      expected.value = "4";
      assert.deepEqual(actual, expected);
    }

    {
      // "Border Spacing"
      const name = "border-spacing-x-96";
      const actual = groupUtil.parseClassname(name, targetGroups, mergedConfig, 31);
      expected.index = 31;
      expected.name = name;
      expected.shorthand = "x";
      expected.variants = "";
      expected.parentType = "Border Spacing";
      expected.body = "border-spacing-x-";
      expected.value = "96";
      assert.deepEqual(actual, expected);
    }

    {
      // "Scale"
      const name = "scale-x-150";
      const actual = groupUtil.parseClassname(name, targetGroups, mergedConfig, 16);
      expected.index = 16;
      expected.name = name;
      expected.shorthand = "x";
      expected.variants = "";
      expected.parentType = "Scale";
      expected.body = "scale-x-";
      expected.value = "150";
      assert.deepEqual(actual, expected);
    }

    {
      // Margin arbitrary value
      const name = "m-[0]";
      const actual = groupUtil.parseClassname(name, targetGroups, mergedConfig, 99);
      expected.index = 99;
      expected.name = name;
      expected.shorthand = "all";
      expected.variants = "";
      expected.parentType = "Margin";
      expected.body = "m-";
      expected.value = "[0]";
      assert.deepEqual(actual, expected);
    }

    {
      // Leading / Trailing
      const name = "  md:gap-x-2  ";
      const actual = groupUtil.parseClassname(name, targetGroups, mergedConfig, 100);
      expected.index = 100;
      expected.name = "md:gap-x-2";
      expected.shorthand = "x";
      expected.variants = "md:";
      expected.parentType = "Gap";
      expected.body = "gap-x-";
      expected.value = "2";
      expected.leading = "  ";
      expected.trailing = "  ";
      assert.deepEqual(actual, expected);
    }

    {
      // Important
      const name = "md:!p-8";
      const actual = groupUtil.parseClassname(name, targetGroups, mergedConfig, 1);
      expected.index = 1;
      expected.name = name;
      expected.body = "!p-";
      expected.leading = "";
      expected.trailing = "";
      expected.shorthand = "";
      expected.parentType = "Padding";
      expected.shorthand = "all";
      expected.variants = "md:";
      expected.value = "8";
      expected.important = true;
      assert.deepEqual(actual, expected);
    }
  });

  it("should support named capture group", () => {
    // eslint-disable-next-line regexp/no-unused-capturing-group
    const regex1 = /^((inset-(?<pos>[0-3])|-inset-(?<negPos>[0-3])))$/;
    const str1 = "-inset-0";
    assert.equal(regex1.exec(str1)?.groups?.negPos, "0");
  });
});

describe("getGroupIndex", () => {
  const targetProperties = {
    Backgrounds: [
      "Background Image URL",
      "Background Attachment",
      "Background Clip",
      "Background Color",
      "Deprecated Background Opacity",
      "Background Origin",
      "Background Position",
      "Background Repeat",
      "Background Size",
      "Background Image",
      "Gradient Color Stops",
    ],
  };
  const targetGroups = defaultGroups.filter(g =>
    Object.keys(targetProperties).includes(g.type)
  );

  it("should have filtered `targetGroups`", () => {
    assert.equal(targetGroups.length, Object.keys(targetProperties).length);
  });

  it(`should parse classnames`, () => {
    const name = "md:bg-[url('/image-md.jpg')]";
    const actual = groupUtil.parseClassname(name, targetGroups, mergedConfig, 0);
    const expected = {
      index: 0,
      name,
      variants: "md:",
      parentType: "Backgrounds",
      body: "bg-[url('/",
      value: "'/image-md.jpg'",
      shorthand: "",
      leading: "",
      trailing: "",
      important: false,
    };
    assert.deepEqual(actual, expected);
  });

  it(`should get correct group index`, () => {
    const groups = groupUtil.getGroups(targetGroups, mergedConfig);
    const name = "md:bg-[url(some)]";
    const actual = groupUtil.getGroupIndex(name, groups);
    const expected = 0;
    assert.equal(actual, expected);
  });
});
