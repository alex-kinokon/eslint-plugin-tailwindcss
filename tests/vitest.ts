// https://lafroscia.com/2023/01/28/testing-eslint-rules.html

import { RuleTester } from "eslint";
import { type SuiteFactory, type TestFunction, describe, it } from "vitest";

function formatMessage(text: string) {
  // eslint-disable-next-line unicorn/prefer-string-raw
  return text.trim().replaceAll("\n", "\\n");
}

class VitestRuleTester extends RuleTester {
  static override describe(message: string, callback: SuiteFactory) {
    describe(message, callback);
  }

  static override it(message: string, callback: TestFunction) {
    it(formatMessage(message), callback);
  }

  static override itOnly(message: string, callback: TestFunction) {
    it.only(message, callback);
  }
}

export function createRuleTester() {
  return new VitestRuleTester({
    languageOptions: {
      ecmaVersion: 2019,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  });
}
