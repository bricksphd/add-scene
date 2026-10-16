import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["out/**", "node_modules/**", ".vscode-test/**", "templates/**"] },
  ...tseslint.configs.recommended,
);
