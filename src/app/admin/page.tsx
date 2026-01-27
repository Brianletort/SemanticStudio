"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Cpu, Database, Workflow, MessageSquare, Users } from "lucide-react";
import Link from "next/link";

const stats = [
  { title: "Domain Agents", value: "28", icon: Bot, href: "/admin/agents", description: "Active domain agents" },
  { title: "Model Configs", value: "9", icon: Cpu, href: "/admin/models", description: "Configured model roles" },
  { title: "Data Sources", value: "0", icon: Database, href: "/admin/data", description: "Connected data sources" },
  { title: "ETL Jobs", value: "0", icon: Workflow, href: "/admin/etl", description: "Running ETL jobs" },
];

export default function AdminDashboard() {
  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <SidebarTrigger />
        <h1 className="font-semibold">Admin Dashboard</h1>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Welcome section */}
          <div className="space-y-2">
            <h2 className="text-3xl font-bold">Welcome to SemanticStudio Admin</h2>
            <p className="text-muted-foreground">
              Manage your domain agents, configure models, and monitor your data pipelines.
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <Link key={stat.title} href={stat.href}>
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                    <stat.icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground">{stat.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Quick actions */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Quick Start
                </CardTitle>
                <CardDescription>Get started with SemanticStudio</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium">1. Configure Models</h4>
                  <p className="text-sm text-muted-foreground">
                    Set up your LLM providers and model assignments in the Model Config page.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">2. Set Up Domain Agents</h4>
                  <p className="text-sm text-muted-foreground">
                    Enable and configure the domain agents you want to use.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">3. Connect Data Sources</h4>
                  <p className="text-sm text-muted-foreground">
                    Connect your data sources to power your domain agents.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">4. Start Chatting</h4>
                  <p className="text-sm text-muted-foreground">
                    Go to the Chat page and start asking questions about your data!
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  System Status
                </CardTitle>
                <CardDescription>Current system health</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Database</span>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-sm text-muted-foreground">Connected</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">OpenAI API</span>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-yellow-500" />
                    <span className="text-sm text-muted-foreground">Not configured</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Anthropic API</span>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-gray-500" />
                    <span className="text-sm text-muted-foreground">Not configured</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Ollama</span>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-gray-500" />
                    <span className="text-sm text-muted-foreground">Not available</span>
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
