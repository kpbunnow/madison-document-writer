import globals from "globals";
const rules = {
  "no-empty": ["error", { allowEmptyCatch: false }],
  "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
  "no-func-assign": "error",
  "no-undef": "error",
};
export default [
  {
    files: ["app/modules/**/*.js", "app/assets/shared.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, today: "readonly", L: "readonly", __TEST_BUILD__: "readonly" },
    },
    rules,
  },
  {
    files: [
      "app/modules/document_types.js",
      "app/modules/document_rules.js",
      "app/modules/writer_queries.js",
      "app/modules/presentation_format.js",
      "app/modules/calendar.js",
      "app/modules/mailing_rules.js",
      "app/modules/record_values.js",
    ],
    rules: {
      "no-restricted-globals": [
        "error",
        "document",
        "window",
        "fetch",
        "indexedDB",
        "localStorage",
        "sessionStorage",
        "XMLHttpRequest",
        "WebSocket",
        "BroadcastChannel",
      ],
    },
  },
];
