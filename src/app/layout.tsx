import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "AgentKit - Multi-Agent Chat Platform",
  description: "Data-first multi-agent chat platform with domain agents",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>
          <SidebarProvider>
            <AppSidebar />
            <main className="flex-1 overflow-hidden">
              {children}
            </main>
          </SidebarProvider>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
