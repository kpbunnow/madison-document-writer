import globals from "globals";
const rules = {
  "no-empty": ["error", { allowEmptyCatch: false }],
  "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
  "no-func-assign": "error",
  "no-undef": "error",
};
export default [
  { ignores: ["build/generated/modules/vendor/**"] },
  {
    files: ["build/app.js", "build/reports.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: { ...globals.browser, today: "readonly", L: "readonly" } },
    rules: { ...rules, "no-empty": "off" },
  },
  {
    files: ["app/modules/**/*.js", "app/assets/shared.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, today: "readonly", L: "readonly", __TEST_BUILD__: "readonly" },
    },
    rules,
  },
];
