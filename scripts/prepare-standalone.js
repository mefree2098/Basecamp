#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");

if (!fs.existsSync(standaloneDir)) {
  console.log("No standalone output found; skipping standalone asset prep.");
  process.exit(0);
}

copyTree(path.join(root, "public"), path.join(standaloneDir, "public"));
copyTree(path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static"));

console.log("Prepared standalone public and static assets.");

function copyTree(source, target) {
  if (!fs.existsSync(source)) return;
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}
