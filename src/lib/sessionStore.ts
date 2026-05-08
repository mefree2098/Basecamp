import "server-only";

import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type {
  AuthProviderId,
  FounderProfile,
  FounderSession,
  FounderUser,
  PlanCard,
  SessionTurn,
  UserNotification,
  UserRole
} from "./types";

const STORAGE_DIR = path.resolve(
  process.cwd(),
  process.env.BASECAMP_STORAGE_DIR ?? ".basecamp-data"
);
const USER_DIR = path.join(STORAGE_DIR, "users");
const AUTH_SESSION_DIR = path.join(STORAGE_DIR, "auth-sessions");
const NOTIFICATION_DIR = path.join(STORAGE_DIR, "notifications");
const SESSION_DIR = path.join(STORAGE_DIR, "founder-sessions");
export const BASECAMP_AUTH_COOKIE = "basecamp.auth";

const AUTH_SESSION_TTL_DAYS = 45;

type SessionInput = {
  userId: string;
  sessionId?: string;
  profile: FounderProfile;
  userMessage: string;
  assistantMessage: string;
  usedProvider: string;
  planCards: PlanCard[];
  completedSteps: string[];
  recommendationIds: string[];
};

type StoredAuthSession = {
  id: string;
  userId: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
};

export function registerFounderUser({
  name,
  email,
  provider = "site",
  avatarUrl
}: {
  name: string;
  email: string;
  provider?: AuthProviderId;
  avatarUrl?: string;
}) {
  ensureDir(USER_DIR);
  const normalizedEmail = normalizeEmail(email);
  const cleanedName = cleanName(name) || fallbackNameFromEmail(normalizedEmail);
  const existingId = readEmailIndex(normalizedEmail);
  if (existingId) {
    const existing = normalizeFounderUser(readJson<FounderUser>(userPath(existingId)));
    if (existing) {
      const providers = Array.from(new Set([...existing.authProviders, provider]));
      const updated = normalizeFounderUser({
        ...existing,
        name: cleanedName || existing.name,
        avatarUrl: avatarUrl ?? existing.avatarUrl ?? makeProviderAvatar(provider, cleanedName, normalizedEmail),
        provider,
        authProviders: providers,
        lastSeenAt: now()
      })!;
      writeJson(userPath(existingId), updated);
      seedUserNotifications(updated);
      return updated;
    }
  }

  const user = normalizeFounderUser({
    id: `user_${randomUUID()}`,
    name: cleanedName,
    email: normalizedEmail,
    avatarUrl: avatarUrl ?? makeProviderAvatar(provider, cleanedName, normalizedEmail),
    provider,
    authProviders: [provider],
    roles: ["founder"],
    createdAt: now(),
    lastSeenAt: now()
  })!;
  writeJson(userPath(user.id), user);
  writeJson(emailIndexPath(normalizedEmail), { userId: user.id });
  seedUserNotifications(user);
  return user;
}

export function getFounderUser(userId: string) {
  return normalizeFounderUser(readJson<FounderUser>(userPath(userId)));
}

export function createFounderAuthSession(userId: string) {
  ensureDir(AUTH_SESSION_DIR);
  const token = randomUUID();
  const createdAt = now();
  const expiresAt = new Date(Date.now() + AUTH_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const session: StoredAuthSession = {
    id: `auth_${randomUUID()}`,
    userId,
    createdAt,
    lastSeenAt: createdAt,
    expiresAt
  };
  writeJson(authSessionPath(token), session);
  touchUser(userId);
  return { token, expiresAt, session };
}

export function readFounderAuthSession(token: string | null | undefined) {
  if (!token) return null;
  const session = readJson<StoredAuthSession>(authSessionPath(token));
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    deleteAuthSession(token);
    return null;
  }
  const user = getFounderUser(session.userId);
  if (!user) {
    deleteAuthSession(token);
    return null;
  }
  const updated = { ...session, lastSeenAt: now() };
  writeJson(authSessionPath(token), updated);
  touchUser(user.id);
  return { session: updated, user };
}

export function deleteAuthSession(token: string | null | undefined) {
  if (!token) return;
  try {
    fs.unlinkSync(authSessionPath(token));
  } catch {
    // The session may have already expired or been removed by another request.
  }
}

export function readAuthTokenFromCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.split("=");
    if (name === BASECAMP_AUTH_COOKIE) {
      return decodeURIComponent(valueParts.join("="));
    }
  }
  return null;
}

export function listUserNotifications(userId: string) {
  const user = getFounderUser(userId);
  if (!user) return [];
  seedUserNotifications(user);
  const notifications = readJson<UserNotification[]>(notificationPath(userId)) ?? [];
  return notifications
    .filter((item) => item.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function markUserNotificationsRead(userId: string, notificationIds?: string[]) {
  const ids = new Set(notificationIds ?? []);
  const notifications = listUserNotifications(userId);
  const readAt = now();
  const updated = notifications.map((notification) =>
    !notification.readAt && (ids.size === 0 || ids.has(notification.id))
      ? { ...notification, readAt }
      : notification
  );
  writeJson(notificationPath(userId), updated);
  return updated.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listFounderSessions(userId: string) {
  ensureDir(SESSION_DIR);
  return fs
    .readdirSync(SESSION_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => readJson<FounderSession>(path.join(SESSION_DIR, file)))
    .filter((session): session is FounderSession => Boolean(session && session.userId === userId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function readFounderSession(sessionId: string) {
  return readJson<FounderSession>(sessionPath(sessionId));
}

export function upsertFounderSession(input: SessionInput) {
  ensureDir(SESSION_DIR);
  const existingSession = input.sessionId ? readFounderSession(input.sessionId) : null;
  const existing = existingSession?.userId === input.userId ? existingSession : null;
  const turn: SessionTurn = {
    id: `turn_${randomUUID()}`,
    createdAt: now(),
    profile: input.profile,
    userMessage: input.userMessage,
    assistantMessage: input.assistantMessage,
    usedProvider: input.usedProvider,
    planCards: input.planCards,
    completedSteps: input.completedSteps,
    recommendationIds: input.recommendationIds
  };
  const session: FounderSession = existing
    ? {
        ...existing,
        updatedAt: now(),
        profile: input.profile,
        completedSteps: input.completedSteps,
        planCards: input.planCards,
        turns: [...existing.turns, turn].slice(-12)
      }
    : {
        id: `session_${randomUUID()}`,
        userId: input.userId,
        title: sessionTitle(input.profile.goal || input.userMessage),
        createdAt: now(),
        updatedAt: now(),
        profile: input.profile,
        completedSteps: input.completedSteps,
        planCards: input.planCards,
        turns: [turn]
      };

  writeJson(sessionPath(session.id), session);
  touchUser(input.userId);
  return session;
}

export function updateFounderSessionProgress({
  sessionId,
  userId,
  completedSteps
}: {
  sessionId: string;
  userId: string;
  completedSteps: string[];
}) {
  const existing = readFounderSession(sessionId);
  if (!existing || existing.userId !== userId) return null;
  const session: FounderSession = {
    ...existing,
    completedSteps,
    updatedAt: now(),
    turns: existing.turns.map((turn, index) =>
      index === existing.turns.length - 1 ? { ...turn, completedSteps } : turn
    )
  };
  writeJson(sessionPath(session.id), session);
  touchUser(userId);
  return session;
}

function touchUser(userId: string) {
  const user = getFounderUser(userId);
  if (user) writeJson(userPath(userId), { ...user, lastSeenAt: now() });
}

function readEmailIndex(email: string) {
  return readJson<{ userId?: string }>(emailIndexPath(email))?.userId;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function cleanName(name: string) {
  return name.replace(/\s+/g, " ").trim();
}

function normalizeFounderUser(user: FounderUser | null) {
  if (!user) return null;
  const provider = user.provider ?? "site";
  const authProviders = user.authProviders?.length ? user.authProviders : [provider];
  const roles = user.roles?.length ? user.roles : defaultRolesForEmail(user.email);
  const normalized: FounderUser = {
    ...user,
    name: cleanName(user.name) || fallbackNameFromEmail(user.email),
    email: normalizeEmail(user.email),
    avatarUrl: user.avatarUrl,
    provider,
    authProviders,
    roles
  };
  return normalized;
}

function defaultRolesForEmail(email: string): UserRole[] {
  const normalized = normalizeEmail(email);
  if (normalized.endsWith("@startupstate.local")) return ["founder"];
  if (normalized.includes("admin")) return ["founder", "admin"];
  return ["founder"];
}

function fallbackNameFromEmail(email: string) {
  const localPart = email.split("@")[0] || "Founder";
  return localPart
    .replace(/[._+-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function makeProviderAvatar(provider: AuthProviderId, name: string, email: string) {
  if (provider === "site") return undefined;
  const colors: Record<AuthProviderId, { bg: string; fg: string; accent: string }> = {
    site: { bg: "#0d8f8c", fg: "#ffffff", accent: "#c79532" },
    google: { bg: "#ffffff", fg: "#1f2937", accent: "#4285f4" },
    microsoft: { bg: "#f4f7fb", fg: "#1f2937", accent: "#7fba00" },
    meta: { bg: "#0866ff", fg: "#ffffff", accent: "#8bd0ff" }
  };
  const label = initialsForName(name || fallbackNameFromEmail(email));
  const palette = colors[provider];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="${palette.bg}"/><circle cx="74" cy="24" r="12" fill="${palette.accent}"/><text x="48" y="57" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="28" font-weight="800" fill="${palette.fg}">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function initialsForName(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0]}` : parts[0]?.slice(0, 2) || "U").toUpperCase();
}

function seedUserNotifications(user: FounderUser) {
  ensureDir(NOTIFICATION_DIR);
  if (fs.existsSync(notificationPath(user.id))) return;
  const createdAt = Date.now();
  const notifications: UserNotification[] = [
    {
      id: `note_${randomUUID()}`,
      userId: user.id,
      category: "wizard",
      title: "Founder Navigator is ready",
      message: "Your saved paths, plan cards, and resource recommendations will follow this account.",
      status: "info",
      href: "/wizard",
      createdAt: new Date(createdAt).toISOString()
    },
    {
      id: `note_${randomUUID()}`,
      userId: user.id,
      category: "form",
      title: "Company profile drafts",
      message: "Submitted company updates will appear here as queued, verified, reviewed, or published.",
      status: "submitted",
      href: "/submit-company",
      createdAt: new Date(createdAt - 1000 * 60 * 12).toISOString()
    },
    {
      id: `note_${randomUUID()}`,
      userId: user.id,
      category: "grant",
      title: "Funding application tracker",
      message: "Grant, loan, and pitch-program status updates are mocked until external application feeds are connected.",
      status: "in_review",
      href: "/resources?topic=Funding",
      createdAt: new Date(createdAt - 1000 * 60 * 41).toISOString()
    },
    {
      id: `note_${randomUUID()}`,
      userId: user.id,
      category: "permit",
      title: "Permit follow-up needed",
      message: "When a permit path is saved, Basecamp will ask for city or county confirmation before marking it complete.",
      status: "action_required",
      href: "/wizard",
      createdAt: new Date(createdAt - 1000 * 60 * 93).toISOString()
    }
  ];
  writeJson(notificationPath(user.id), notifications);
}

function sessionTitle(goal: string) {
  const cleaned = goal.replace(/\s+/g, " ").trim();
  return cleaned.length > 56 ? `${cleaned.slice(0, 53)}...` : cleaned || "Founder path";
}

function userPath(userId: string) {
  return path.join(USER_DIR, `${safeFileName(userId)}.json`);
}

function emailIndexPath(email: string) {
  const hash = createHash("sha256").update(email).digest("hex");
  return path.join(USER_DIR, `email_${hash}.json`);
}

function authSessionPath(token: string) {
  const hash = createHash("sha256").update(token).digest("hex");
  return path.join(AUTH_SESSION_DIR, `${hash}.json`);
}

function notificationPath(userId: string) {
  return path.join(NOTIFICATION_DIR, `${safeFileName(userId)}.json`);
}

function sessionPath(sessionId: string) {
  return path.join(SESSION_DIR, `${safeFileName(sessionId)}.json`);
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "");
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson<T>(filePath: string) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeJson(filePath: string, value: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function now() {
  return new Date().toISOString();
}
