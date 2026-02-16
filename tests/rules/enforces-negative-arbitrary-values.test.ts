/* eslint-disable no-template-curly-in-string */
/**
 * @fileoverview Warns about `-` prefixed classnames using arbitrary values
 * @author François Massart
 */
import rule from "../../src/rules/enforces-negative-arbitrary-values.ts";
import type { ESLintPluginTailwindOptions as Options } from "../../src/types.ts";
import { createRuleTester } from "../vitest.ts";

const skipClassAttributeOptions: Options[] = [
  { skipClassAttribute: true, config: { theme: {} } },
];

const generateErrors = (classes: string) =>
  classes.split(" ").map(classname => ({
    messageId: "negativeArbitraryValue",
    data: { classname },
  }));

const ruleTester = createRuleTester();

// eslint-disable-next-line vitest/require-hook
ruleTester.run("enforces-negative-arbitrary-values", rule, {
  valid: [
    { code: '<div class="top-[-50px]">top-[-50px]</div>' },
    { code: "<div class={ctl(`top-[-50px]`)}>top-[-50px]</div>" },
    { code: "<div className={`top-[-50px]`}>top-[-50px]</div>" },
    { code: "<div className>No errors while typing</div>" },
    {
      code: "<div className={`-top-[-50px] ${ctl('inset-y-[-1px]')}`}>skipClassAttribute</div>",
      options: skipClassAttributeOptions,
    },
  ],
  invalid: [
    {
      code: '<div class="-inset-[1px] -inset-y-[1px] -inset-x-[1px] -top-[1px] -right-[1px] -bottom-[1px] -left-[1px] -top-[1px] -z-[2] -order-[2] -m-[1px] -my-[1px] -mx-[1px] -mt-[1px] -mr-[1px] -mb-[1px] -ml-[1px] -mt-[1px] -space-y-[1px] -space-x-[1px] -tracking-[1px] -indent-[1px] -hue-rotate-[50%] -backdrop-hue-rotate-[50%] -scale-[50%] -scale-y-[50%] -scale-x-[50%] -rotate-[45deg] -translate-x-[1px] -translate-y-[1px] -skew-x-[45deg] -skew-y-[45deg] -scroll-m-[1px] -scroll-my-[1px] -scroll-mx-[1px] -scroll-mt-[1px] -scroll-mr-[1px] -scroll-mb-[1px] -scroll-ml-[1px] -scroll-mt-[1px]">all</div>',
      errors: generateErrors(
        "-inset-[1px] -inset-y-[1px] -inset-x-[1px] -top-[1px] -right-[1px] -bottom-[1px] -left-[1px] -top-[1px] -z-[2] -order-[2] -m-[1px] -my-[1px] -mx-[1px] -mt-[1px] -mr-[1px] -mb-[1px] -ml-[1px] -mt-[1px] -space-y-[1px] -space-x-[1px] -tracking-[1px] -indent-[1px] -hue-rotate-[50%] -backdrop-hue-rotate-[50%] -scale-[50%] -scale-y-[50%] -scale-x-[50%] -rotate-[45deg] -translate-x-[1px] -translate-y-[1px] -skew-x-[45deg] -skew-y-[45deg] -scroll-m-[1px] -scroll-my-[1px] -scroll-mx-[1px] -scroll-mt-[1px] -scroll-mr-[1px] -scroll-mb-[1px] -scroll-ml-[1px] -scroll-mt-[1px]"
      ),
    },
    {
      code: `
      <div className={\`-top-[-50px] \${ctl('-inset-y-[1px]')}\`}>skipClassAttribute</div>
      `,
      options: skipClassAttributeOptions,
      errors: generateErrors("-inset-y-[1px]"),
    },
    {
      code: `cva({
        primary: ["-inset-[1px] -inset-y-[1px] -inset-x-[1px] -top-[1px] -right-[1px] -bottom-[1px] -left-[1px] -top-[1px] -z-[2] -order-[2] -m-[1px] -my-[1px] -mx-[1px] -mt-[1px] -mr-[1px] -mb-[1px] -ml-[1px] -mt-[1px] -space-y-[1px] -space-x-[1px] -tracking-[1px] -indent-[1px] -hue-rotate-[50%] -backdrop-hue-rotate-[50%] -scale-[50%] -scale-y-[50%] -scale-x-[50%] -rotate-[45deg] -translate-x-[1px] -translate-y-[1px] -skew-x-[45deg] -skew-y-[45deg] -scroll-m-[1px] -scroll-my-[1px] -scroll-mx-[1px] -scroll-mt-[1px] -scroll-mr-[1px] -scroll-mb-[1px] -scroll-ml-[1px] -scroll-mt-[1px]"]
      });`,
      options: [{ callees: ["cva"] }] satisfies Options[],
      errors: generateErrors(
        "-inset-[1px] -inset-y-[1px] -inset-x-[1px] -top-[1px] -right-[1px] -bottom-[1px] -left-[1px] -top-[1px] -z-[2] -order-[2] -m-[1px] -my-[1px] -mx-[1px] -mt-[1px] -mr-[1px] -mb-[1px] -ml-[1px] -mt-[1px] -space-y-[1px] -space-x-[1px] -tracking-[1px] -indent-[1px] -hue-rotate-[50%] -backdrop-hue-rotate-[50%] -scale-[50%] -scale-y-[50%] -scale-x-[50%] -rotate-[45deg] -translate-x-[1px] -translate-y-[1px] -skew-x-[45deg] -skew-y-[45deg] -scroll-m-[1px] -scroll-my-[1px] -scroll-mx-[1px] -scroll-mt-[1px] -scroll-mr-[1px] -scroll-mb-[1px] -scroll-ml-[1px] -scroll-mt-[1px]"
      ),
    },
    {
      code: '<div class="group/edit:-inset-[1px] group/edit:top-[-1px]">support named group/peer syntax</div>',
      errors: generateErrors("group/edit:-inset-[1px]"),
    },
    ...["myTag", "myTag.subTag", "myTag(SomeComponent)"].map(tag => ({
      code: `${tag}\`-my-[1px] -mx-[1px]\``,
      errors: generateErrors("-my-[1px] -mx-[1px]"),
      options: [{ tags: ["myTag"] }] satisfies Options[],
    })),
  ],
});
