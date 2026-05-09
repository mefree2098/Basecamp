#!/usr/bin/env node

Error.stackTraceLimit = 100;
Error.prepareStackTrace = (error, frames) => {
  const header = `${error.name}: ${error.message}`;
  const details = frames.map((frame) => {
    const file = frame.getFileName() || frame.getScriptNameOrSourceURL() || "<unknown>";
    const location = `${file}:${frame.getLineNumber() ?? "?"}:${frame.getColumnNumber() ?? "?"}`;
    const fn = frame.getFunctionName() || frame.getMethodName() || "<anonymous>";
    return `    at ${fn} (${location})`;
  });
  return [header, ...details].join("\n");
};

process.env.NODE_ENV = process.env.NODE_ENV || "production";
process.env.NEXT_RUNTIME = "nodejs";
process.env.NEXT_TELEMETRY_DISABLED = "1";

main().catch((error) => {
  console.error("");
  console.error("> Build error occurred");
  console.error(formatError(error));
  process.exit(1);
});

async function main() {
  const projectDir = process.cwd();
  const buildModule = loadNextBuildModule();
  const { Bundler } = require("next/dist/lib/bundler");
  const build = buildModule.default || buildModule;

  await build(
    projectDir,
    false,
    false,
    Boolean(process.env.NEXT_DEBUG_BUILD),
    false,
    false,
    false,
    Bundler.Webpack,
    "default",
    undefined,
    undefined,
    {}
  );
}

function loadNextBuildModule() {
  const configPath = require.resolve("next/dist/server/config", { paths: [process.cwd()] });
  const configModule = require(configPath);
  const loadConfig = configModule.default || configModule;

  require.cache[configPath].exports = {
    ...configModule,
    __esModule: true,
    default: async (...args) => {
      const config = await loadConfig(...args);
      if (config.deploymentId || typeof config.generateBuildId === "function") {
        return config;
      }

      return {
        ...config,
        generateBuildId: () => null
      };
    }
  };

  return require("next/dist/build");
}

function formatError(error) {
  if (error instanceof Error) {
    return error.stack || `${error.name}: ${error.message}`;
  }
  return String(error);
}
