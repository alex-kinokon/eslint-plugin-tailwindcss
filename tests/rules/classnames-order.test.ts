/**
 * @fileoverview Use a consistent orders for the Tailwind CSS classnames, based on property then on variants
 * @author François Massart
 */
/* eslint-disable unicorn/string-content */
/* eslint-disable no-template-curly-in-string */
import tsParser from "@typescript-eslint/parser";

import rule from "../../src/rules/classnames-order.ts";
import type { ESLintPluginTailwindOptions as Options } from "../../src/types.ts";
import { createRuleTester } from "../vitest.ts";

const ruleTester = createRuleTester();

const err = { messageId: "invalidOrder" } as const;
const errors = [err];
const errors2 = [err, err];

const sharedOptions: Options[] = [
  { config: "tests/rules/tailwind.classnames-order.shared.config.css" },
];

const skipClassAttributeOptions: Options[] = [
  { skipClassAttribute: true, config: { theme: {} } },
];

// eslint-disable-next-line vitest/require-hook
ruleTester.run("classnames-order", rule, {
  valid: [
    {
      code: '<div class="custom container box-content lg:box-border">Simple, basic</div>',
    },
    {
      code: `<div tw="custom container box-content lg:box-border">Simple, using 'tw' prop</div>`,
      options: [{ classRegex: "^tw$" }] satisfies Options[],
    },
    {
      code: "<div className={ctl(`w-full p-10 ${live && 'bg-blue-100 sm:rounded-lg dark:bg-purple-400'}`)}>ctl + exp</div>",
    },
    {
      code: "<div className={ctl(`h-48 w-48 rounded-full bg-blue-500 ${className}`)}>ctl + var</div>",
    },
    {
      code: "<div className={ctl(`w-full p-10 ${live && 'bg-white dark:bg-black'}`)}>Space trim issue</div>",
    },
    {
      code: "<div class='box-content lg:box-border'>Simple quotes</div>",
    },
    {
      code: '<div class="space-y-0.5 ">Extra space at the end</div>',
    },
    {
      code: `<div tw="space-y-0.5 ">Extra space at the end, but with 'tw' prop</div>`,
      options: [{ classRegex: "^tw$" }] satisfies Options[],
    },
    {
      code: `<div class="p-5 sm:px-3 md:py-2 lg:p-4 xl:px-6">'p', then 'py' then 'px'</div>`,
    },
    {
      code: `ctl(\`
        container
        flex
        w-12
        sm:w-6
        lg:w-4
      \`)`,
    },
    {
      code: '<div class="lorem-w-12 lg:lorem-w-6">Custom prefix</div>',
      options: [{ config: { prefix: "lorem-" } }] satisfies Options[],
    },
    {
      code: '<div class="w-12 lg:w-[500px]">Allowed arbitrary value</div>',
    },
    {
      code: '<div class="dark:focus:hover:bg-black md:dark:disabled:focus:hover:bg-gray-400">Stackable variants</div>',
    },
    {
      code: "<div className={clsx(`absolute bottom-0 flex h-[270px] w-full flex-col`)}>clsx</div>",
      options: [{ callees: ["clsx"] }] satisfies Options[],
    },
    {
      code: '<div class="opts-w-12 lg:opts-w-6">Options override shared settings</div>',
      options: [{ config: { prefix: "opts-" } }] satisfies Options[],
      settings: {
        tailwindcss: { config: { prefix: "sttgs-" } },
      },
    },
    {
      code: '<div class="sttgs-w-12 lg:sttgs-w-6">Use settings</div>',
      settings: {
        tailwindcss: { config: { prefix: "sttgs-" } },
      },
    },
    ...["myTag", "myTag.subTag", "myTag(SomeComponent)"].map(tag => ({
      code: `${tag}\`
        container
        flex
        w-12
        sm:w-6
        lg:w-4
      \``,
      options: [{ tags: ["myTag"] }] satisfies Options[],
    })),
    {
      code: '<div class="z-dialog flex w-12">Number values</div>',
      settings: {
        tailwindcss: { config: { theme: { zIndex: { dialog: 10000 } } } },
      },
    },
    {
      code: '<div class="   flex  space-y-0.5   ">Extra spaces</div>',
    },
    {
      code: '<div class="container animate-spin first:flex">Valid using mode official</div>',
    },
    {
      code: '<div class="lorem-container lorem-animate-spin first_lorem-flex">Valid using mode official</div>',
      options: [{ config: { prefix: "lorem-" } }],
    },
    {
      code: '<div class="bg-deque-blue text-large flex h-9 w-9 items-center justify-center rounded-full border-4 border-solid border-blue-100 text-white">https://github.com/francoismassart/eslint-plugin-tailwindcss/issues/109#issuecomment-1044625260 no config, so bg-deque-blue text-large goes at first position because custom</div>',
    },
    {
      code: '<div class="flex h-9 w-9 items-center justify-center rounded-full border-4 border-solid border-blue-100 bg-deque-blue text-large text-white">https://github.com/francoismassart/eslint-plugin-tailwindcss/issues/109#issuecomment-1044625260</div>',
      options: sharedOptions,
    },
    {
      code: '<div className={`relative w-full overflow-hidden ${yolo ? "flex flex-col" : "block"}`}>Issue #131</div>',
    },
    {
      code: "<div class>No errors while typing</div>",
    },
    {
      code: "<div className={`sm:flex block ${ctl('relative w-full overflow-hidden')}`}>skipClassAttribute</div>",
      options: skipClassAttributeOptions,
    },
    {
      code: '<div class="py-1\u3000px-2 block">Do not treat full width space as class separator</div>',
    },
    {
      code: `
        const func = () => ({ a: 12 });
        <div className={clsx(['text-sm', {
          ...func()
        }])}>Spread of a function return inside clsx</div>
      `,
    },
  ],
  invalid: [
    {
      code: `
      export interface FakePropsInterface {
        readonly name?: string;
      }
      function Fake({
        name = 'yolo'
      }: FakeProps) {
        return (
          <>
            <h1 className={"absolute bottom-0 w-full flex flex-col"}>Welcome {name}</h1>
            <p>Bye {name}</p>
          </>
        );
      }
      export default Fake;
      `,
      output: `
      export interface FakePropsInterface {
        readonly name?: string;
      }
      function Fake({
        name = 'yolo'
      }: FakeProps) {
        return (
          <>
            <h1 className={"absolute bottom-0 flex w-full flex-col"}>Welcome {name}</h1>
            <p>Bye {name}</p>
          </>
        );
      }
      export default Fake;
      `,
      languageOptions: {
        ecmaVersion: 2019,
        sourceType: "module",
        parser: tsParser,
        parserOptions: {
          ecmaFeatures: {
            jsx: true,
          },
        },
      },
      errors,
    },
    {
      code: '<div class="sm:w-6 container w-12">Classnames will be ordered</div>',
      output: '<div class="container w-12 sm:w-6">Classnames will be ordered</div>',
      errors,
    },
    {
      code: '<div class="sm:py-5 p-4 sm:px-7 lg:p-8">Enhancing readability</div>',
      output: '<div class="p-4 sm:px-7 sm:py-5 lg:p-8">Enhancing readability</div>',
      errors,
    },
    {
      code: `<div tw="sm:py-5 p-4 sm:px-7 lg:p-8">Enhancing readability with 'tw' prop</div>`,
      output: `<div tw="p-4 sm:px-7 sm:py-5 lg:p-8">Enhancing readability with 'tw' prop</div>`,
      options: [{ classRegex: "^tw$" }] satisfies Options[],
      errors,
    },
    {
      code: '<div class="grid grid-cols-1 sm:grid-cols-2 sm:px-8 sm:py-12 sm:gap-x-8 md:py-16">:)...</div>',
      output:
        '<div class="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-8 sm:px-8 sm:py-12 md:py-16">:)...</div>',
      errors,
    },
    {
      code: "ctl(`p-10 w-full ${some}`)",
      output: "ctl(`w-full p-10 ${some}`)",
      errors,
    },
    {
      code: "<div className={ctl(`p-10 w-full ${live && 'bg-white dark:bg-black'}`)}>Space trim issue with fix</div>",
      output:
        "<div className={ctl(`w-full p-10 ${live && 'bg-white dark:bg-black'}`)}>Space trim issue with fix</div>",
      errors,
    },
    {
      code: '<div class="md:prose-2xl prose-xl prose sm:prose-sm"></div>',
      output: '<div class="prose prose-xl sm:prose-sm md:prose-2xl"></div>',
      options: [
        { config: "tests/rules/tailwind.typography.config.css" },
      ] satisfies Options[],
      errors,
    },
    {
      code: '<div class="sm:line-clamp-3 line-clamp-2"></div>',
      output: '<div class="line-clamp-2 sm:line-clamp-3"></div>',
      options: [
        { config: "tests/rules/tailwind.line-clamp.config.css" },
      ] satisfies Options[],
      errors,
    },
    {
      code: "<div class='lg:box-border box-content'>Simple quotes</div>",
      output: "<div class='box-content lg:box-border'>Simple quotes</div>",
      errors,
    },
    {
      options: [{ removeDuplicates: false }] satisfies Options[],
      code: '<div class="w-12 lg:w-6 w-12">removeDuplicates: false</div>',
      output: '<div class="w-12 w-12 lg:w-6">removeDuplicates: false</div>',
      errors,
    },
    {
      code: '<div class="w-12  lg:w-6   w-12">Single line dups + no head/tail spaces</div>',
      output: '<div class="w-12   lg:w-6">Single line dups + no head/tail spaces</div>',
      errors,
    },
    {
      code: '<div class=" w-12  lg:w-6   w-12">Single dups line + head spaces</div>',
      output: '<div class=" w-12   lg:w-6">Single dups line + head spaces</div>',
      errors,
    },
    {
      code: '<div class="w-12  lg:w-6   w-12 ">Single line dups + tail spaces</div>',
      output: '<div class="w-12   lg:w-6 ">Single line dups + tail spaces</div>',
      errors,
    },
    {
      // Multiline + both head/tail spaces
      code: `
      ctl(\`
        invalid
        sm:w-6
        container
        invalid
        flex
        container
        w-12
        flex
        container
        lg:w-4
        lg:w-4
      \`);`,
      output: `
      ctl(\`
        invalid
        container
        flex
        w-12
        sm:w-6
        lg:w-4
      \`);`,
      errors,
    },
    {
      code: `
      ctl(\`
        invalid
        sm:w-6
        container
        w-12
        flex
        lg:w-4
      \`);`,
      output: `
      ctl(\`
        invalid
        container
        flex
        w-12
        sm:w-6
        lg:w-4
      \`);`,
      errors,
    },
    {
      code: `
      const buttonClasses = ctl(\`
        \${fullWidth ? "w-12" : "w-6"}
        container
        \${fullWidth ? "sm:w-8" : "sm:w-4"}
        lg:w-9
        flex
        \${hasError && "bg-red"}
      \`);`,
      output: `
      const buttonClasses = ctl(\`
        \${fullWidth ? "w-12" : "w-6"}
        container
        \${fullWidth ? "sm:w-8" : "sm:w-4"}
        flex
        lg:w-9
        \${hasError && "bg-red"}
      \`);`,
      errors,
    },
    {
      code: `
      const buttonClasses = ctl(\`
        \${fullWidth ? "w-12" : "w-6"}
        flex
        container
        \${fullWidth ? "sm:w-7" : "sm:w-4"}
        lg:py-4
        sm:py-6
        \${hasError && "bg-red"}
      \`);`,
      output: `
      const buttonClasses = ctl(\`
        \${fullWidth ? "w-12" : "w-6"}
        container
        flex
        \${fullWidth ? "sm:w-7" : "sm:w-4"}
        sm:py-6
        lg:py-4
        \${hasError && "bg-red"}
      \`);`,
      errors: errors2,
    },
    {
      code: '<div class="sm:w-12 w-[320px]">Allowed arbitrary value but incorrect order</div>',
      output:
        '<div class="w-[320px] sm:w-12">Allowed arbitrary value but incorrect order</div>',
      errors,
    },
    {
      code: "clsx(`absolute bottom-0 w-full h-[70px] flex flex-col`);",
      output: "clsx(`absolute bottom-0 flex h-[70px] w-full flex-col`);",
      options: [{ callees: ["clsx"] }] satisfies Options[],
      errors,
    },
    {
      code: `cva({
          primary: ["absolute bottom-0 w-full h-[70px] flex flex-col"],
        })`,
      output: `cva({
          primary: ["absolute bottom-0 flex h-[70px] w-full flex-col"],
        })`,
      options: [{ callees: ["cva"] }] satisfies Options[],
      errors,
    },
    {
      code: "<div className={clsx(`absolute bottom-0 w-full h-[270px] flex flex-col`)}>clsx</div>",
      output:
        "<div className={clsx(`absolute bottom-0 flex h-[270px] w-full flex-col`)}>clsx</div>",
      options: [{ callees: ["clsx"] }] satisfies Options[],
      errors,
    },
    {
      code: `
      ctl(\`
        px-2
        flex
        \${
          !isDisabled &&
          \`
            top-0
            flex
            border-0
          \`
        }
        \${
          isDisabled &&
          \`
            border-0
            mx-0
          \`
        }
      \`)
      `,
      output: `
      ctl(\`
        flex
        px-2
        \${
          !isDisabled &&
          \`
            top-0
            flex
            border-0
          \`
        }
        \${
          isDisabled &&
          \`
            mx-0
            border-0
          \`
        }
      \`)
      `,
      errors: errors2,
    },
    {
      code: '<div className="px-2 flex">...</div>',
      output: '<div className="flex px-2">...</div>',
      errors,
    },
    {
      code: 'ctl(`${enabled && "px-2 flex"}`)',
      output: 'ctl(`${enabled && "flex px-2"}`)',
      errors,
    },
    {
      code: "ctl(`px-2 flex`)",
      output: "ctl(`flex px-2`)",
      errors,
    },
    {
      code: `
      ctl(\`
        px-2
        flex
      \`)
      `,
      output: `
      ctl(\`
        flex
        px-2
      \`)
      `,
      errors,
    },
    {
      code: `
      <div
        className="
          fixed
          right-0
          top-0
          bottom-0
          left-0
          transition-all
          transform
        "
      >
        #19
      </div>
      `,
      output: `
      <div
        className="
          fixed
          top-0
          right-0
          bottom-0
          left-0
          transform
          transition-all
        "
      >
        #19
      </div>
      `,
      errors,
    },
    {
      code: `
      <div
        className={clsx(
          "w-full h-10 rounded",
          name === "white"
            ? "ring-black flex"
            : undefined
        )}
      />
      `,
      output: `
      <div
        className={clsx(
          "h-10 w-full rounded",
          name === "white"
            ? "flex ring-black"
            : undefined
        )}
      />
      `,
      errors: errors2,
    },
    ...["myTag", "myTag.subTag", "myTag(SomeComponent)"].flatMap(tag => [
      {
        code: `
        ${tag}\`
          invalid
          sm:w-6
          container
          w-12
          flex
          lg:w-4
        \`;`,
        output: `
        ${tag}\`
          invalid
          container
          flex
          w-12
          sm:w-6
          lg:w-4
        \`;`,
        options: [{ tags: ["myTag"] }] satisfies Options[],
        errors,
      },
      {
        code: `
        const buttonClasses = ${tag}\`
          \${fullWidth ? "w-12" : "w-6"}
          container
          \${fullWidth ? "sm:w-8" : "sm:w-4"}
          lg:w-9
          flex
          \${hasError && "bg-red"}
        \`;`,
        output: `
        const buttonClasses = ${tag}\`
          \${fullWidth ? "w-12" : "w-6"}
          container
          \${fullWidth ? "sm:w-8" : "sm:w-4"}
          flex
          lg:w-9
          \${hasError && "bg-red"}
        \`;`,
        options: [{ tags: ["myTag"] }] satisfies Options[],
        errors,
      },
      {
        code: `
        const buttonClasses = ${tag}\`
          \${fullWidth ? "w-12" : "w-6"}
          flex
          container
          \${fullWidth ? "sm:w-7" : "sm:w-4"}
          lg:py-4
          sm:py-6
          \${hasError && "bg-red"}
        \`;`,
        output: `
        const buttonClasses = ${tag}\`
          \${fullWidth ? "w-12" : "w-6"}
          container
          flex
          \${fullWidth ? "sm:w-7" : "sm:w-4"}
          sm:py-6
          lg:py-4
          \${hasError && "bg-red"}
        \`;`,
        options: [{ tags: ["myTag"] }] satisfies Options[],
        errors: errors2,
      },
    ]),
    {
      code: `
      classnames([
        'invalid lg:w-4 sm:w-6',
        ['w-12 flex'],
      ])`,
      output: `
      classnames([
        'invalid sm:w-6 lg:w-4',
        ['flex w-12'],
      ])`,
      errors: errors2,
    },
    {
      code: `
      classnames({
        invalid,
        flex: myFlag,
        'lg:w-4 sm:w-6': resize
      })`,
      output: `
      classnames({
        invalid,
        flex: myFlag,
        'sm:w-6 lg:w-4': resize
      })`,
      errors,
    },
    {
      code: '<div class="first:flex animate-spin custom container">Using official sorting</div>',
      output:
        '<div class="custom container animate-spin first:flex">Using official sorting</div>',
      errors,
    },
    {
      code: 'ctl(`${some} container animate-spin first:flex ${bool ? "flex-col flex" : ""}`)',
      output:
        'ctl(`${some} container animate-spin first:flex ${bool ? "flex flex-col" : ""}`)',
      errors,
    },
    {
      code: "ctl(`p-3 border-gray-300 m-4 h-24 lg:p-4 flex border-2 lg:m-4`)",
      output: "ctl(`m-4 flex h-24 border-2 border-gray-300 p-3 lg:m-4 lg:p-4`)",
      errors,
    },
    {
      // https://github.com/francoismassart/eslint-plugin-tailwindcss/issues/131
      code: "<Button className={'relative w-full h-full overflow-hidden'}>Single quotes</Button>",
      output:
        "<Button className={'relative h-full w-full overflow-hidden'}>Single quotes</Button>",
      errors,
    },
    {
      // https://github.com/francoismassart/eslint-plugin-tailwindcss/issues/131
      code: "<Button className={`relative w-full h-full overflow-hidden`}>{name}</Button>",
      output:
        "<Button className={`relative h-full w-full overflow-hidden`}>{name}</Button>",
      errors,
    },
    {
      code: "<div className={`sm:flex block ${ctl('w-full relative')}`}>skipClassAttribute</div>",
      output:
        "<div className={`sm:flex block ${ctl('relative w-full')}`}>skipClassAttribute</div>",
      options: skipClassAttributeOptions,
      errors,
    },
    {
      code: '<div class="block group/edit:stroke-0">support named group/peer syntax</div>',
      output:
        '<div class="group/edit:stroke-0 block">support named group/peer syntax</div>',
      errors,
    },
  ],
});
