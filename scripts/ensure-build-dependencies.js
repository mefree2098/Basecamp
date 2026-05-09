#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const requiredBuildPackages = [
  "node_modules/typescript/package.json",
  "node_modules/eslint/package.json",
  "node_modules/@types/node/package.json"
];

if (requiredBuildPackages.every((entry) => fs.existsSync(path.join(root, entry)))) {
  process.exit(0);
}

console.log("Build dependencies are missing; reinstalling with dev dependencies included.");

const result = spawnSync("npm", ["ci", "--include=dev"], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: "",
    npm_config_production: "false",
    NEXT_TELEMETRY_DISABLED: "1"
  },
  encoding: "utf8",
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
