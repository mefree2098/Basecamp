import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type CodexHomeProfile = "auto" | "azure" | "aws" | "local" | "custom";

export function deriveCodexHome({
  profile,
  explicitHome,
  awsVolumeRoot
}: {
  profile?: CodexHomeProfile;
  explicitHome?: string;
  awsVolumeRoot?: string;
}) {
  const selected = profile ?? "auto";
  if (selected === "custom" && explicitHome) return explicitHome;
  if (explicitHome && selected !== "auto") return explicitHome;
  if (selected === "azure") return "/home/site/.codex/basecamp";
  if (selected === "aws") return path.join(awsVolumeRoot || "/mnt/efs", ".codex/basecamp");
  if (selected === "local") {
    return path.join(/* turbopackIgnore: true */ process.cwd(), ".basecamp-data", "codex-home");
  }

  if (process.env.WEBSITE_SITE_NAME || process.env.WEBSITE_INSTANCE_ID) {
    return "/home/site/.codex/basecamp";
  }
  if (
    process.env.AWS_EXECUTION_ENV ||
    process.env.ECS_CONTAINER_METADATA_URI ||
    process.env.ECS_CONTAINER_METADATA_URI_V4 ||
    process.env.EKS_CLUSTER_NAME
  ) {
    return path.join(awsVolumeRoot || "/mnt/efs", ".codex/basecamp");
  }
  const configuredHome = process.env.CODEX_HOME;
  if (configuredHome) {
    return path.isAbsolute(configuredHome)
      ? configuredHome
      : path.join(/* turbopackIgnore: true */ process.cwd(), configuredHome);
  }
  return path.join(/* turbopackIgnore: true */ process.cwd(), ".basecamp-data", "codex-home");
}

export function resolveWritableCodexHome(candidates: string[]) {
  for (const candidate of candidates) {
    try {
      fs.mkdirSync(candidate, { recursive: true });
      fs.accessSync(candidate, fs.constants.W_OK);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  const fallback = path.join(os.tmpdir(), "basecamp-codex-home");
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

export function enforceFileCredentialStore(codexHome: string) {
  fs.mkdirSync(codexHome, { recursive: true });
  const configPath = path.join(codexHome, "config.toml");
  const existing = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : "";
  const required = [
    'cli_auth_credentials_store = "file"',
    'mcp_oauth_credentials_store = "file"'
  ];
  const next = [...required.filter((line) => !existing.includes(line)), existing]
    .filter(Boolean)
    .join("\n");
  if (next !== existing) {
    fs.writeFileSync(configPath, next);
  }
}
