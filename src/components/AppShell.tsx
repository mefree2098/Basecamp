"use client";

/* eslint-disable @next/next/no-img-element */

import type { FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  ClipboardList,
  FileText,
  LogIn,
  LogOut,
  MapPin,
  Palette,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards
} from "lucide-react";
import type { AuthProviderId, FounderUser, UserNotification } from "@/lib/types";
import { AuthProvider, useAuth } from "./AuthContext";
import { BrandMark } from "./BrandMark";

const navItems = [
  { href: "/map", label: "Map", icon: MapPin },
  { href: "/resources", label: "Resources", icon: BookOpen },
  { href: "/wizard", label: "Founder Wizard", icon: Sparkles },
  { href: "/submit-company", label: "Companies", icon: Building2 },
  { href: "/admin", label: "Admin", icon: ShieldCheck }
];

const providerOptions: Array<{ id: Exclude<AuthProviderId, "site">; label: string }> = [
  { id: "microsoft", label: "Microsoft" },
  { id: "google", label: "Google" },
  { id: "meta", label: "Meta" }
];

type ThemeName = "classic" | "tech";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AppShellChrome>{children}</AppShellChrome>
    </AuthProvider>
  );
}

function AppShellChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, notifications, unreadCount, signIn, signOut, markNotificationsRead } = useAuth();
  const [theme, setTheme] = useState<ThemeName>("classic");
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [authForm, setAuthForm] = useState({ name: "", email: "" });
  const [authStatus, setAuthStatus] = useState("");
  const actionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTheme(readInitialTheme());
      setThemeLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!themeLoaded) return;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("basecamp.theme", theme);
    window.dispatchEvent(new CustomEvent("basecamp-theme-change", { detail: { theme } }));
  }, [theme, themeLoaded]);

  useEffect(() => {
    function closeMenus(event: MouseEvent) {
      if (!actionsRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
        setAccountOpen(false);
      }
    }
    window.addEventListener("mousedown", closeMenus);
    return () => window.removeEventListener("mousedown", closeMenus);
  }, []);

  async function submitSiteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authForm.name.trim() || !authForm.email.trim()) {
      setAuthStatus("Add your name and email.");
      return;
    }
    setAuthStatus("Creating account...");
    try {
      await signIn({ provider: "site", name: authForm.name, email: authForm.email });
      setAuthStatus("");
      setAccountOpen(false);
    } catch (error) {
      setAuthStatus(error instanceof Error ? error.message : "Sign in failed.");
    }
  }

  async function signInWithProvider(provider: Exclude<AuthProviderId, "site">) {
    setAuthStatus(`Connecting ${providerLabel(provider)}...`);
    try {
      await signIn({
        provider,
        name: authForm.name || undefined,
        email: authForm.email || undefined
      });
      setAuthStatus("");
      setAccountOpen(false);
    } catch (error) {
      setAuthStatus(error instanceof Error ? error.message : "Sign in failed.");
    }
  }

  return (
    <div className="app-frame">
      <header className="topbar">
        <BrandMark />
        <label className="topbar-search">
          <Search size={20} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search startups, founders, sectors, or locations..."
            aria-label="Search Startup State"
          />
          <kbd>⌘K</kbd>
        </label>
        <nav aria-label="Primary navigation" className="topbar__nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href} className={active ? "active" : undefined}>
                <Icon aria-hidden="true" size={17} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="theme-switcher" aria-label="Theme">
          <Palette size={16} aria-hidden="true" />
          <button
            type="button"
            className={theme === "classic" ? "active" : undefined}
            onClick={() => setTheme("classic")}
          >
            Classic
          </button>
          <button
            type="button"
            className={theme === "tech" ? "active" : undefined}
            onClick={() => setTheme("tech")}
          >
            Tech
          </button>
        </div>
        <div className="topbar-actions" aria-label="Account actions" ref={actionsRef}>
          <div className="topbar-menu-wrap">
            <button
              type="button"
              className="topbar-action"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              onClick={() => {
                const nextOpen = !notificationsOpen;
                setNotificationsOpen(nextOpen);
                setAccountOpen(false);
                if (nextOpen && user) void markNotificationsRead();
              }}
            >
              <Bell size={19} aria-hidden="true" />
              {unreadCount > 0 ? <span>{unreadCount}</span> : null}
            </button>
            {notificationsOpen ? (
              <NotificationsMenu user={user} notifications={notifications} />
            ) : null}
          </div>
          <div className="topbar-menu-wrap">
            <button
              type="button"
              className="topbar-user"
              aria-label="Open account menu"
              aria-expanded={accountOpen}
              onClick={() => {
                setAccountOpen((open) => !open);
                setNotificationsOpen(false);
              }}
            >
              <UserAvatar user={user} />
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            {accountOpen ? (
              <AccountMenu
                user={user}
                authForm={authForm}
                authStatus={authStatus}
                onAuthFormChange={setAuthForm}
                onSubmitSiteAccount={submitSiteAccount}
                onProviderSignIn={signInWithProvider}
                onSignOut={() => void signOut()}
              />
            ) : null}
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

function NotificationsMenu({
  user,
  notifications
}: {
  user: FounderUser | null;
  notifications: UserNotification[];
}) {
  return (
    <div className="topbar-popover topbar-popover--notifications" role="dialog" aria-label="Notifications">
      <div className="popover-heading">
        <strong>Notifications</strong>
        <small>{user ? `${notifications.length} updates` : "Sign in for updates"}</small>
      </div>
      {user ? (
        <div className="notification-list">
          {notifications.map((notification) => (
            <Link href={notification.href ?? "/wizard"} className="notification-item" key={notification.id}>
              <span className={`notification-dot notification-dot--${notification.status}`} />
              <span>
                <strong>{notification.title}</strong>
                <small>{notification.message}</small>
                <em>{notificationStatusLabel(notification.status)}</em>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="popover-empty">
          <Bell size={22} aria-hidden="true" />
          <p>Application, permit, grant, and profile updates will appear here.</p>
        </div>
      )}
    </div>
  );
}

function AccountMenu({
  user,
  authForm,
  authStatus,
  onAuthFormChange,
  onSubmitSiteAccount,
  onProviderSignIn,
  onSignOut
}: {
  user: FounderUser | null;
  authForm: { name: string; email: string };
  authStatus: string;
  onAuthFormChange: (form: { name: string; email: string }) => void;
  onSubmitSiteAccount: (event: FormEvent<HTMLFormElement>) => void;
  onProviderSignIn: (provider: Exclude<AuthProviderId, "site">) => void;
  onSignOut: () => void;
}) {
  if (!user) {
    return (
      <div className="topbar-popover topbar-popover--account" role="dialog" aria-label="Account menu">
        <div className="popover-heading">
          <strong>Create your profile</strong>
          <small>Save wizard progress and applications</small>
        </div>
        <div className="provider-button-grid" aria-label="Provider sign in">
          {providerOptions.map((provider) => (
            <button
              type="button"
              className={`provider-button provider-button--${provider.id}`}
              key={provider.id}
              onClick={() => onProviderSignIn(provider.id)}
            >
              <span aria-hidden="true" />
              {provider.label}
            </button>
          ))}
        </div>
        <form className="account-auth-form" onSubmit={onSubmitSiteAccount}>
          <label>
            <span>Name</span>
            <input
              value={authForm.name}
              onChange={(event) => onAuthFormChange({ ...authForm, name: event.target.value })}
            />
          </label>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={authForm.email}
              onChange={(event) => onAuthFormChange({ ...authForm, email: event.target.value })}
            />
          </label>
          <button className="ghost-button" type="submit">
            <LogIn size={16} aria-hidden="true" />
            Register
          </button>
        </form>
        {authStatus ? <p className="status-line">{authStatus}</p> : null}
      </div>
    );
  }

  return (
    <div className="topbar-popover topbar-popover--account" role="dialog" aria-label="Account menu">
      <div className="account-profile-card">
        <UserAvatar user={user} large />
        <span>
          <strong>{user.name}</strong>
          <small>{user.email}</small>
          <em>{providerLabel(user.provider)} account</em>
        </span>
      </div>
      <div className="account-option-list">
        <Link href="/wizard">
          <ClipboardList size={16} aria-hidden="true" />
          Founder workbench
        </Link>
        <Link href="/submit-company">
          <BriefcaseBusiness size={16} aria-hidden="true" />
          Company profiles
        </Link>
        <Link href="/resources?topic=Funding">
          <WalletCards size={16} aria-hidden="true" />
          Grants and funding
        </Link>
        <Link href="/resources?topic=Permits">
          <FileText size={16} aria-hidden="true" />
          Permits and forms
        </Link>
        <Link href="/profile">
          <Settings size={16} aria-hidden="true" />
          Profile and settings
        </Link>
        <button type="button" onClick={onSignOut}>
          <LogOut size={16} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  );
}

function UserAvatar({ user, large = false }: { user: FounderUser | null; large?: boolean }) {
  const label = user ? initialsForName(user.name) : "SU";
  return (
    <span className={large ? "topbar-avatar topbar-avatar--large" : "topbar-avatar"} aria-hidden="true">
      {user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user ? label : <UserRound size={20} />}
    </span>
  );
}

function providerLabel(provider: AuthProviderId) {
  const labels: Record<AuthProviderId, string> = {
    site: "Startup State",
    google: "Google",
    microsoft: "Microsoft",
    meta: "Meta"
  };
  return labels[provider];
}

function notificationStatusLabel(status: UserNotification["status"]) {
  const labels: Record<UserNotification["status"], string> = {
    submitted: "Submitted",
    in_review: "In review",
    action_required: "Action required",
    approved: "Approved",
    info: "Update"
  };
  return labels[status];
}

function initialsForName(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0]}` : parts[0]?.slice(0, 2) || "U").toUpperCase();
}

function readInitialTheme(): ThemeName {
  if (typeof window === "undefined") return "classic";
  return window.localStorage.getItem("basecamp.theme") === "tech" ? "tech" : "classic";
}
