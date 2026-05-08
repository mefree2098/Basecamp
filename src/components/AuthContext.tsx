"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type {
  AuthProviderId,
  AuthSessionResponse,
  FounderSession,
  UserNotification
} from "@/lib/types";

type SignInInput = {
  provider: AuthProviderId;
  name?: string;
  email?: string;
};

type SignInResponse = AuthSessionResponse & {
  sessions?: FounderSession[];
};

type AuthContextValue = AuthSessionResponse & {
  loading: boolean;
  refresh: () => Promise<AuthSessionResponse>;
  signIn: (input: SignInInput) => Promise<SignInResponse>;
  signOut: () => Promise<void>;
  markNotificationsRead: (ids?: string[]) => Promise<UserNotification[]>;
};

const emptySession: AuthSessionResponse = {
  user: null,
  notifications: [],
  unreadCount: 0
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSessionResponse>(emptySession);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    const nextSession = (await response.json()) as AuthSessionResponse;
    setSession(nextSession);
    syncLegacyFounderUser(nextSession.user);
    return nextSession;
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      refresh()
        .catch(() => {
          if (active) setSession(emptySession);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [refresh]);

  const signIn = useCallback(async (input: SignInInput) => {
    const response = await fetch("/api/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    const data = (await response.json()) as SignInResponse & { error?: string };
    if (!response.ok || data.error) {
      throw new Error(data.error ?? "Sign in failed.");
    }
    setSession({
      user: data.user,
      notifications: data.notifications,
      unreadCount: data.unreadCount
    });
    syncLegacyFounderUser(data.user);
    window.dispatchEvent(new CustomEvent("basecamp-auth-change", { detail: { user: data.user } }));
    return data;
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => null);
    setSession(emptySession);
    syncLegacyFounderUser(null);
    window.dispatchEvent(new CustomEvent("basecamp-auth-change", { detail: { user: null } }));
  }, []);

  const markNotificationsRead = useCallback(async (ids?: string[]) => {
    const response = await fetch("/api/auth/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    });
    if (!response.ok) return session.notifications;
    const data = (await response.json()) as Pick<AuthSessionResponse, "notifications" | "unreadCount">;
    setSession((current) => ({
      ...current,
      notifications: data.notifications,
      unreadCount: data.unreadCount
    }));
    return data.notifications;
  }, [session.notifications]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...session,
      loading,
      refresh,
      signIn,
      signOut,
      markNotificationsRead
    }),
    [loading, markNotificationsRead, refresh, session, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}

function syncLegacyFounderUser(user: AuthSessionResponse["user"]) {
  if (typeof window === "undefined") return;
  if (user) {
    window.localStorage.setItem("basecamp.founderUser", JSON.stringify(user));
  } else {
    window.localStorage.removeItem("basecamp.founderUser");
  }
}
