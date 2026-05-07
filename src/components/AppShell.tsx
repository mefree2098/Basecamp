import Link from "next/link";
import {
  Bot,
  Building2,
  ClipboardCheck,
  Compass,
  Database,
  Map,
  Settings2
} from "lucide-react";
import { BrandMark } from "./BrandMark";

const navItems = [
  { href: "/wizard", label: "Navigator", icon: Compass },
  { href: "/resources", label: "Resources", icon: Database },
  { href: "/map", label: "Startup Map", icon: Map },
  { href: "/submit-company", label: "Submit", icon: Building2 },
  { href: "/admin", label: "Admin", icon: ClipboardCheck },
  { href: "/admin/ai", label: "AI", icon: Bot }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-frame">
      <header className="topbar">
        <BrandMark />
        <nav aria-label="Primary navigation" className="topbar__nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <Icon aria-hidden="true" size={17} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Link className="icon-button" href="/admin/ai" aria-label="AI settings">
          <Settings2 aria-hidden="true" size={19} />
        </Link>
      </header>
      <main>{children}</main>
    </div>
  );
}
