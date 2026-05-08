"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  FileText,
  LogIn,
  LogOut,
  Settings,
  UserRound,
  WalletCards
} from "lucide-react";
import type { AuthProviderId, UserNotification } from "@/lib/types";
import { useAuth } from "./AuthContext";

const providerOptions: Array<{ id: Exclude<AuthProviderId, "site">; label: string }> = [
  { id: "microsoft", label: "Microsoft" },
  { id: "google", label: "Google" },
  { id: "meta", label: "Meta" }
];

export function UserProfilePage() {
  const { user, notifications, loading, signIn, signOut, markNotificationsRead } = useAuth();
  const [authForm, setAuthForm] = useState({ name: "", email: "" });
  const [status, setStatus] = useState("");

  async function submitSiteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Creating account...");
    try {
      await signIn({ provider: "site", name: authForm.name, email: authForm.email });
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sign in failed.");
    }
  }

  async function signInWithProvider(provider: Exclude<AuthProviderId, "site">) {
    setStatus(`Connecting ${providerLabel(provider)}...`);
    try {
      await signIn({ provider, name: authForm.name || undefined, email: authForm.email || undefined });
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sign in failed.");
    }
  }

  if (loading) {
    return (
      <section className="admin-panel profile-settings">
        <p className="status-line">Loading profile...</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="admin-panel profile-settings">
        <div className="section-heading">
          <span className="eyebrow">
            <UserRound size={15} aria-hidden="true" />
            Profile
          </span>
          <h1>Create your Startup State profile</h1>
          <p>Save founder conversations, company drafts, application updates, and resource progress.</p>
        </div>
        <div className="provider-button-grid" aria-label="Provider registration">
          {providerOptions.map((provider) => (
            <button
              type="button"
              className={`provider-button provider-button--${provider.id}`}
              key={provider.id}
              onClick={() => void signInWithProvider(provider.id)}
            >
              <span aria-hidden="true" />
              {provider.label}
            </button>
          ))}
        </div>
        <form className="profile-settings__form" onSubmit={submitSiteAccount}>
          <label className="input-field">
            <span>Name</span>
            <input
              value={authForm.name}
              onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
            />
          </label>
          <label className="input-field">
            <span>Email</span>
            <input
              type="email"
              value={authForm.email}
              onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
            />
          </label>
          <button className="primary-button" type="submit">
            <LogIn size={16} aria-hidden="true" />
            Register
          </button>
        </form>
        {status ? <p className="status-line">{status}</p> : null}
      </section>
    );
  }

  return (
    <section className="profile-settings">
      <div className="admin-panel profile-settings__hero">
        <div className="profile-settings__avatar" aria-hidden="true">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initialsForName(user.name)}
        </div>
        <div className="section-heading">
          <span className="eyebrow">
            <UserRound size={15} aria-hidden="true" />
            Profile
          </span>
          <h1>{user.name}</h1>
          <p>{user.email}</p>
        </div>
        <button className="ghost-button" type="button" onClick={() => void signOut()}>
          <LogOut size={16} aria-hidden="true" />
          Sign out
        </button>
      </div>

      <div className="profile-settings__grid">
        <div className="admin-panel">
          <h2>Account</h2>
          <dl className="profile-facts profile-facts--simple">
            <div>
              <dt>Provider</dt>
              <dd>{providerLabel(user.provider)}</dd>
            </div>
            <div>
              <dt>Roles</dt>
              <dd>{user.roles.map(roleLabel).join(", ")}</dd>
            </div>
            <div>
              <dt>Last seen</dt>
              <dd>{formatDate(user.lastSeenAt)}</dd>
            </div>
            <div>
              <dt>Connected</dt>
              <dd>{user.authProviders.map(providerLabel).join(", ")}</dd>
            </div>
          </dl>
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
          </div>
        </div>

        <div className="admin-panel">
          <div className="profile-settings__panel-heading">
            <h2>Status updates</h2>
            <button className="ghost-button" type="button" onClick={() => void markNotificationsRead()}>
              <CheckCircle2 size={16} aria-hidden="true" />
              Mark read
            </button>
          </div>
          <div className="notification-list notification-list--page">
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
        </div>
      </div>

      <div className="admin-panel profile-settings__preferences">
        <div>
          <span className="eyebrow">
            <Settings size={15} aria-hidden="true" />
            Preferences
          </span>
          <h2>Notification channels</h2>
        </div>
        <label>
          <input type="checkbox" defaultChecked />
          <span>
            <strong>Application and form status</strong>
            <small>Company profile drafts, permits, registrations, and review decisions.</small>
          </span>
        </label>
        <label>
          <input type="checkbox" defaultChecked />
          <span>
            <strong>Funding updates</strong>
            <small>Grants, loans, pitch programs, and saved resource changes.</small>
          </span>
        </label>
        <label>
          <input type="checkbox" defaultChecked />
          <span>
            <strong>Founder Navigator follow-ups</strong>
            <small>Saved plan cards, unfinished steps, and resume prompts.</small>
          </span>
        </label>
        <p className="status-line">
          <Bell size={14} aria-hidden="true" />
          Preferences are local until the hosted database is connected.
        </p>
      </div>
    </section>
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

function roleLabel(role: string) {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}
