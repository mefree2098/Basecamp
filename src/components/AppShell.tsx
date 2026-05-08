"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Bell,
  BookOpen,
  ChevronDown,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { BrandMark } from "./BrandMark";

const navItems = [
  { href: "/map", label: "Map", icon: MapPin },
  { href: "/resources", label: "Resources", icon: BookOpen },
  { href: "/wizard", label: "Founder Wizard", icon: Sparkles },
  { href: "/submit-company", label: "Companies", icon: Building2 },
  { href: "/admin", label: "Admin", icon: ShieldCheck }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

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
        <div className="topbar-actions" aria-label="Account actions">
          <button type="button" className="topbar-action" aria-label="Notifications">
            <Bell size={19} aria-hidden="true" />
            <span>6</span>
          </button>
          <button type="button" className="topbar-user" aria-label="Open account menu">
            <span aria-hidden="true">MS</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
