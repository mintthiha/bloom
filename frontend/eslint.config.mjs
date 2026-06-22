import { createRequire } from "module";
import prettierConfig from "eslint-config-prettier";

const require = createRequire(import.meta.url);
const nextCoreWebVitals = require("eslint-config-next/core-web-vitals");

export default [
  ...nextCoreWebVitals,
  prettierConfig,
  {
    ignores: [".next/**", "node_modules/**"],
  },
  {
    rules: {
      // Setting loading/initialisation state at the start of async effects is a valid pattern
      "react-hooks/set-state-in-effect": "off",
    },
  },
];
