import "server-only";

import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type {
  FounderProfile,
  FounderSession,
  FounderUser,
  PlanCard,
  SessionTurn
} from "./types";

const STORAGE_DIR = path.resolve(
  process.cwd(),
  process.env.BASECAMP_STORAGE_DIR ?? ".basecamp-data"
);
const USER_DIR = path.join(STORAGE_DIR, "users");
const SESSION_DIR = path.join(STORAGE_DIR, "founder-sessions");

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

export function registerFounderUser({
  name,
  email
}: {
  name: string;
  email: string;
}) {
  ensureDir(USER_DIR);
  const normalizedEmail = normalizeEmail(email);
  const existingId = readEmailIndex(normalizedEmail);
  if (existingId) {
    const existing = readJson<FounderUser>(userPath(existingId));
    if (existing) {
      const updated = { ...existing, name: cleanName(name) || existing.name, lastSeenAt: now() };
      writeJson(userPath(existingId), updated);
      return updated;
    }
  }

  const user: FounderUser = {
    id: `user_${randomUUID()}`,
    name: cleanName(name),
    email: normalizedEmail,
    createdAt: now(),
    lastSeenAt: now()
  };
  writeJson(userPath(user.id), user);
  writeJson(emailIndexPath(normalizedEmail), { userId: user.id });
  return user;
}

export function getFounderUser(userId: string) {
  return readJson<FounderUser>(userPath(userId));
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
