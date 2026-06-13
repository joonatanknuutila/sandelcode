import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { RoleProvider } from "@/components/RoleProvider";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser, getNotifications } from "@/lib/db";

// HMD Secure uses Inter as its brand face (see BRAND.md).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HMD Secure CRM",
  description: "Internal CRM for HMD Secure — accounts, deals, cases, forecast.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const me = await getCurrentUser();
  const user = {
    name: me?.name ?? "Guest",
    initials: me?.initials ?? "—",
  };
  const notifications = me ? await getNotifications(me.id) : [];
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <RoleProvider>
          <AppShell user={user} notifications={notifications}>{children}</AppShell>
        </RoleProvider>
      </body>
    </html>
  );
}
