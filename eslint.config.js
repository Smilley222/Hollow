import js from "@eslint/js";

const nodeGlobals = {
  process: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  Date: "readonly",
  JSON: "readonly",
  Math: "readonly",
  URL: "readonly",
};

const browserGlobals = {
  window: "readonly",
  document: "readonly",
  WebSocket: "readonly",
  console: "readonly",
  requestAnimationFrame: "readonly",
  setInterval: "readonly",
};

export default [
  {
    ...js.configs.recommended,
    files: ["server.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: nodeGlobals,
    },
  },
  {
    ...js.configs.recommended,
    files: ["public/client.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: browserGlobals,
    },
  },
];
