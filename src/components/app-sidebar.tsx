"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  MessageSquare,
  Settings,
  Settings2,
  Users,
  Cpu,
  Database,
  FileText,
  Workflow,
  Home,
  Bot,
  Network,
  Eye,
} from "lucide-react";

const chatItems = [
  { title: "Chat", url: "/", icon: MessageSquare },
  { title: "Settings", url: "/settings", icon: Settings },
];

const adminItems = [
  { title: "Dashboard", url: "/admin", icon: Home },
  { title: "Observability", url: "/admin/observability", icon: Eye },
  { title: "Domain Agents", url: "/admin/agents", icon: Bot },
  { title: "Model Config", url: "/admin/models", icon: Cpu },
  { title: "Mode Config", url: "/admin/modes", icon: Settings2 },
  { title: "Data Sources", url: "/admin/data", icon: Database },
  { title: "ETL Jobs", url: "/admin/etl", icon: Workflow },
  { title: "Knowledge Graph", url: "/admin/graph", icon: Network },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold">AgentKit</span>
            <span className="text-xs text-muted-foreground">Multi-Agent Chat</span>
          </div>
        </Link>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Chat</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {chatItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Administration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="text-xs text-muted-foreground">
          <p>AgentKit v0.1.0</p>
          <p>Open Source Multi-Agent Platform</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
