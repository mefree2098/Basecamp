import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Basecamp | Startup State",
  description: "Founder navigator, resource explorer, and startup map for Utah's Startup State.",
  icons: {
    icon: "/brand/basecamp-iconography.png",
    apple: "/brand/basecamp-iconography.png"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
