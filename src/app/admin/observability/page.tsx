"use client";

import { useState, useEffect, useMemo } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Eye,
  RefreshCw,
  MessageSquare,
  Users,
  Zap,
  TrendingUp,
  Globe,
  Database,
  Brain,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

// Types
interface Stats {
  totalUsers: number;
  totalSessions: number;
  totalMessages: number;
  todayMessages: number;
  activeUsersNow: number;
  avgQualityScore: number | null;
  hallucinationRate: number;
  qualityBreakdown: {
    relevance: number | null;
    groundedness: number | null;
    coherence: number | null;
    completeness: number | null;
  };
  totalEvaluations: number;
}

interface Analytics {
  modeDistribution: {
    quick: number;
    think: number;
    deep: number;
    research: number;
  };
  domainAgentUsage: Array<{
    agentId: string;
    domain: string;
    count: number;
    avgDurationMs: number;
  }>;
  webVsLocal: {
    webEnabled: number;
    localOnly: number;
    total: number;
  };
  activityHeatmap: Array<{
    dayOfWeek: number;
    hourOfDay: number;
    count: number;
  }>;
  qualityTrend: Array<{
    date: string;
    avgQuality: number | null;
    avgRelevance: number | null;
    avgGroundedness: number | null;
    avgCoherence: number | null;
    avgCompleteness: number | null;
    hallucinationCount: number;
    totalCount: number;
  }>;
  topTopics: Array<{
    topic: string;
    count: number;
    recentExamples: string[];
  }>;
  responseTimeDistribution: Array<{
    bucket: string;
    count: number;
  }>;
  messagesPerDay: Array<{
    date: string;
    userMessages: number;
    assistantMessages: number;
  }>;
}

interface User {
  id: string;
  email: string | null;
  name: string | null;
  createdAt: string;
  sessionCount: number;
  messageCount: number;
  lastActive: string | null;
  avgQualityScore: number | null;
  favoriteMode: string | null;
  topDomainAgents: string[];
}

interface SessionDetail {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  mode: string | null;
  webEnabled: boolean;
  domainAgentsUsed: string[];
  messages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string;
  }>;
  evaluation: {
    qualityScore: number | null;
    relevanceScore: number | null;
    groundednessScore: number | null;
    coherenceScore: number | null;
    completenessScore: number | null;
    hallucinationDetected: boolean | null;
    judgeReasoning: string | null;
  } | null;
}

// Colors
const MODE_COLORS = {
  quick: "#3b82f6",
  think: "#10b981",
  deep: "#8b5cf6",
  research: "#f59e0b",
};

const CHART_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4"];

const QUALITY_COLORS = {
  relevance: "#3b82f6",
  groundedness: "#10b981",
  coherence: "#8b5cf6",
  completeness: "#f59e0b",
};

// Days of week
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ObservabilityPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSessions, setUserSessions] = useState<SessionDetail[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, analyticsRes, usersRes] = await Promise.all([
        fetch("/api/admin/observability"),
        fetch("/api/admin/observability/analytics"),
        fetch("/api/admin/observability/users"),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data);
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserSessions = async (userId: string) => {
    setLoadingSessions(true);
    try {
      const res = await fetch(`/api/admin/observability/sessions/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setUserSessions(data.sessions || []);
      }
    } catch (error) {
      console.error("Failed to fetch user sessions:", error);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleUserClick = (user: User) => {
    setSelectedUser(user);
    fetchUserSessions(user.id);
  };

  // Prepare chart data
  const modeChartData = useMemo(() => {
    if (!analytics) return [];
    return [
      { name: "Quick", value: analytics.modeDistribution.quick, color: MODE_COLORS.quick },
      { name: "Think", value: analytics.modeDistribution.think, color: MODE_COLORS.think },
      { name: "Deep", value: analytics.modeDistribution.deep, color: MODE_COLORS.deep },
      { name: "Research", value: analytics.modeDistribution.research, color: MODE_COLORS.research },
    ].filter((d) => d.value > 0);
  }, [analytics]);

  const webVsLocalData = useMemo(() => {
    if (!analytics) return [];
    return [
      { name: "Web Search", value: analytics.webVsLocal.webEnabled, color: "#3b82f6" },
      { name: "Local Only", value: analytics.webVsLocal.localOnly, color: "#10b981" },
    ].filter((d) => d.value > 0);
  }, [analytics]);

  const qualityRadarData = useMemo(() => {
    if (!stats?.qualityBreakdown) return [];
    return [
      {
        subject: "Relevance",
        value: (stats.qualityBreakdown.relevance || 0) * 100,
        fullMark: 100,
      },
      {
        subject: "Groundedness",
        value: (stats.qualityBreakdown.groundedness || 0) * 100,
        fullMark: 100,
      },
      {
        subject: "Coherence",
        value: (stats.qualityBreakdown.coherence || 0) * 100,
        fullMark: 100,
      },
      {
        subject: "Completeness",
        value: (stats.qualityBreakdown.completeness || 0) * 100,
        fullMark: 100,
      },
    ];
  }, [stats]);

  // Build heatmap grid
  const heatmapGrid = useMemo((): { grid: number[][]; maxCount: number } => {
    if (!analytics?.activityHeatmap) return { grid: [], maxCount: 1 };
    
    // Create a 7x24 grid (days x hours)
    const grid: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
    let maxCount = 1;
    
    for (const item of analytics.activityHeatmap) {
      if (item.dayOfWeek >= 0 && item.dayOfWeek < 7 && item.hourOfDay >= 0 && item.hourOfDay < 24) {
        grid[item.dayOfWeek][item.hourOfDay] = item.count;
        maxCount = Math.max(maxCount, item.count);
      }
    }
    
    return { grid, maxCount };
  }, [analytics]);

  const getHeatmapColor = (count: number, maxCount: number) => {
    if (count === 0) return "bg-muted";
    const intensity = count / maxCount;
    if (intensity < 0.25) return "bg-green-200 dark:bg-green-900";
    if (intensity < 0.5) return "bg-green-400 dark:bg-green-700";
    if (intensity < 0.75) return "bg-green-500 dark:bg-green-600";
    return "bg-green-600 dark:bg-green-500";
  };

  const formatQualityScore = (score: number | null) => {
    if (score === null) return "N/A";
    return (score * 100).toFixed(0) + "%";
  };

  const getModeColor = (mode: string | null) => {
    if (!mode) return "secondary";
    const colors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      quick: "secondary",
      think: "default",
      deep: "outline",
      research: "destructive",
    };
    return colors[mode] || "secondary";
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <header className="flex items-center gap-2 border-b px-4 py-3">
          <SidebarTrigger />
          <h1 className="font-semibold">Observability</h1>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <SidebarTrigger />
        <Eye className="h-5 w-5" />
        <h1 className="font-semibold">Observability Dashboard</h1>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          {/* Hero Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.totalSessions?.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.totalMessages?.toLocaleString() || 0} total messages
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Today's Activity</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.todayMessages?.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">
                  messages today
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg Quality Score</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {stats?.avgQualityScore ? `${(stats.avgQualityScore * 100).toFixed(0)}%` : "N/A"}
                </div>
                <p className="text-xs text-muted-foreground">
                  from {stats?.totalEvaluations || 0} evaluations
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.activeUsersNow || 0}</div>
                <p className="text-xs text-muted-foreground">
                  in last 15 minutes
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabbed Content */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="questions">Question Insights</TabsTrigger>
              <TabsTrigger value="quality">Quality Metrics</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Mode Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      Mode Distribution
                    </CardTitle>
                    <CardDescription>How users interact with the system</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {modeChartData.length > 0 ? (
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={modeChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={2}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                            >
                              {modeChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                        No mode data available
                      </div>
                    )}
                    <div className="flex justify-center gap-4 mt-4">
                      {Object.entries(MODE_COLORS).map(([mode, color]) => (
                        <div key={mode} className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-xs capitalize">{mode}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Web vs Local */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      Web vs Local Queries
                    </CardTitle>
                    <CardDescription>Question source breakdown</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {webVsLocalData.length > 0 ? (
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={webVsLocalData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={2}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                            >
                              {webVsLocalData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                        No query data available
                      </div>
                    )}
                    <div className="flex justify-center gap-4 mt-4">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-xs">Web Search</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-xs">Local Knowledge</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Domain Agent Usage */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Domain Agent Usage
                  </CardTitle>
                  <CardDescription>Most utilized domain agents</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics?.domainAgentUsage && analytics.domainAgentUsage.length > 0 ? (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={analytics.domainAgentUsage.slice(0, 10)}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="domain" type="category" width={90} tick={{ fontSize: 12 }} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-background border rounded-lg p-2 shadow-lg">
                                    <p className="font-medium">{data.domain}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {data.count} queries
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      Avg: {(data.avgDurationMs / 1000).toFixed(1)}s
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No domain agent data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Activity Heatmap */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Activity Heatmap
                  </CardTitle>
                  <CardDescription>When users ask questions (last 30 days)</CardDescription>
                </CardHeader>
                <CardContent>
                  {heatmapGrid.grid.length > 0 && heatmapGrid.grid.some((row: number[]) => row.some((v: number) => v > 0)) ? (
                    <div className="space-y-2">
                      <div className="flex gap-1">
                        <div className="w-8" />
                        {Array.from({ length: 24 }, (_, i) => (
                          <div key={i} className="w-4 text-[10px] text-muted-foreground text-center">
                            {i % 6 === 0 ? i : ""}
                          </div>
                        ))}
                      </div>
                      {DAYS.map((day, dayIdx) => (
                        <div key={day} className="flex gap-1 items-center">
                          <div className="w-8 text-xs text-muted-foreground">{day}</div>
                          {heatmapGrid.grid[dayIdx].map((count: number, hourIdx: number) => (
                            <div
                              key={hourIdx}
                              className={`w-4 h-4 rounded-sm ${getHeatmapColor(count, heatmapGrid.maxCount)}`}
                              title={`${day} ${hourIdx}:00 - ${count} questions`}
                            />
                          ))}
                        </div>
                      ))}
                      <div className="flex items-center gap-2 mt-4 justify-end">
                        <span className="text-xs text-muted-foreground">Less</span>
                        <div className="w-3 h-3 rounded-sm bg-muted" />
                        <div className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900" />
                        <div className="w-3 h-3 rounded-sm bg-green-400 dark:bg-green-700" />
                        <div className="w-3 h-3 rounded-sm bg-green-500 dark:bg-green-600" />
                        <div className="w-3 h-3 rounded-sm bg-green-600 dark:bg-green-500" />
                        <span className="text-xs text-muted-foreground">More</span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                      No activity data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Question Insights Tab */}
            <TabsContent value="questions" className="space-y-4">
              {/* Topics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Popular Topics
                  </CardTitle>
                  <CardDescription>Most frequently discussed subjects</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics?.topTopics && analytics.topTopics.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {analytics.topTopics.map((topic, idx) => {
                        // Size based on relative frequency
                        const maxCount = analytics.topTopics[0].count;
                        const relativeSize = topic.count / maxCount;
                        const fontSize = 0.75 + relativeSize * 0.75; // 0.75rem to 1.5rem
                        
                        return (
                          <Badge
                            key={topic.topic}
                            variant="secondary"
                            className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                            style={{ fontSize: `${fontSize}rem`, padding: `${0.25 + relativeSize * 0.25}rem ${0.5 + relativeSize * 0.25}rem` }}
                            title={`${topic.count} mentions`}
                          >
                            {topic.topic}
                            <span className="ml-1 opacity-60">{topic.count}</span>
                          </Badge>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                      No topic data available yet
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Response Time Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Response Time Distribution</CardTitle>
                  <CardDescription>How quickly the system responds</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics?.responseTimeDistribution && analytics.responseTimeDistribution.some(d => d.count > 0) ? (
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.responseTimeDistribution}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                      No response time data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Messages Per Day */}
              <Card>
                <CardHeader>
                  <CardTitle>Daily Message Volume</CardTitle>
                  <CardDescription>User and assistant messages over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics?.messagesPerDay && analytics.messagesPerDay.length > 0 ? (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analytics.messagesPerDay}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10 }}
                            tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          />
                          <YAxis />
                          <Tooltip
                            labelFormatter={(value) => new Date(value).toLocaleDateString()}
                          />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="userMessages"
                            name="User Messages"
                            stackId="1"
                            stroke="#3b82f6"
                            fill="#3b82f6"
                            fillOpacity={0.6}
                          />
                          <Area
                            type="monotone"
                            dataKey="assistantMessages"
                            name="Assistant Messages"
                            stackId="1"
                            stroke="#10b981"
                            fill="#10b981"
                            fillOpacity={0.6}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No message data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Quality Tab */}
            <TabsContent value="quality" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Quality Radar */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quality Score Breakdown</CardTitle>
                    <CardDescription>Average scores across dimensions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {qualityRadarData.length > 0 && qualityRadarData.some(d => d.value > 0) ? (
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={qualityRadarData}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} />
                            <Radar
                              name="Quality"
                              dataKey="value"
                              stroke="#3b82f6"
                              fill="#3b82f6"
                              fillOpacity={0.5}
                            />
                            <Tooltip formatter={(value) => `${Number(value).toFixed(0)}%`} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        No quality data available
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Hallucination Rate */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Hallucination Detection
                    </CardTitle>
                    <CardDescription>Rate of detected hallucinations</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center h-[300px]">
                      <div className="text-6xl font-bold">
                        {stats?.hallucinationRate !== undefined
                          ? `${(stats.hallucinationRate * 100).toFixed(1)}%`
                          : "N/A"}
                      </div>
                      <p className="text-muted-foreground mt-2">
                        hallucination rate
                      </p>
                      {stats?.hallucinationRate !== undefined && stats.hallucinationRate < 0.05 && (
                        <Badge variant="default" className="mt-4 bg-green-500">
                          Excellent
                        </Badge>
                      )}
                      {stats?.hallucinationRate !== undefined && stats.hallucinationRate >= 0.05 && stats.hallucinationRate < 0.15 && (
                        <Badge variant="default" className="mt-4 bg-yellow-500">
                          Good
                        </Badge>
                      )}
                      {stats?.hallucinationRate !== undefined && stats.hallucinationRate >= 0.15 && (
                        <Badge variant="destructive" className="mt-4">
                          Needs Attention
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quality Trend */}
              <Card>
                <CardHeader>
                  <CardTitle>Quality Score Trends</CardTitle>
                  <CardDescription>Quality metrics over the last 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics?.qualityTrend && analytics.qualityTrend.length > 0 ? (
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analytics.qualityTrend}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10 }}
                            tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          />
                          <YAxis domain={[0, 1]} tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
                          <Tooltip
                            labelFormatter={(value) => new Date(String(value)).toLocaleDateString()}
                            formatter={(value) => value ? `${(Number(value) * 100).toFixed(1)}%` : 'N/A'}
                          />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="avgRelevance"
                            name="Relevance"
                            stroke={QUALITY_COLORS.relevance}
                            fill={QUALITY_COLORS.relevance}
                            fillOpacity={0.2}
                          />
                          <Area
                            type="monotone"
                            dataKey="avgGroundedness"
                            name="Groundedness"
                            stroke={QUALITY_COLORS.groundedness}
                            fill={QUALITY_COLORS.groundedness}
                            fillOpacity={0.2}
                          />
                          <Area
                            type="monotone"
                            dataKey="avgCoherence"
                            name="Coherence"
                            stroke={QUALITY_COLORS.coherence}
                            fill={QUALITY_COLORS.coherence}
                            fillOpacity={0.2}
                          />
                          <Area
                            type="monotone"
                            dataKey="avgCompleteness"
                            name="Completeness"
                            stroke={QUALITY_COLORS.completeness}
                            fill={QUALITY_COLORS.completeness}
                            fillOpacity={0.2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                      No quality trend data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    User Activity
                  </CardTitle>
                  <CardDescription>Click on a user to view their sessions</CardDescription>
                </CardHeader>
                <CardContent>
                  {users.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Sessions</TableHead>
                          <TableHead>Messages</TableHead>
                          <TableHead>Favorite Mode</TableHead>
                          <TableHead>Avg Quality</TableHead>
                          <TableHead>Last Active</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow
                            key={user.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleUserClick(user)}
                          >
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  {user.name || user.email || "Anonymous"}
                                </div>
                                {user.email && user.name && (
                                  <div className="text-xs text-muted-foreground">
                                    {user.email}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{user.sessionCount}</TableCell>
                            <TableCell>{user.messageCount}</TableCell>
                            <TableCell>
                              {user.favoriteMode && (
                                <Badge variant={getModeColor(user.favoriteMode)}>
                                  {user.favoriteMode}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{formatQualityScore(user.avgQualityScore)}</TableCell>
                            <TableCell>
                              {user.lastActive
                                ? new Date(user.lastActive).toLocaleDateString()
                                : "Never"}
                            </TableCell>
                            <TableCell>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No users found
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* User Sessions Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectedUser?.name || selectedUser?.email || "User"}'s Sessions
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.sessionCount} sessions, {selectedUser?.messageCount} messages
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1">
            {loadingSessions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : userSessions.length > 0 ? (
              <div className="space-y-4 pr-4">
                {userSessions.map((session) => (
                  <Card
                    key={session.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedSession(session)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{session.title}</CardTitle>
                          <CardDescription>
                            {new Date(session.createdAt).toLocaleString()} • {session.messageCount} messages
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          {session.mode && (
                            <Badge variant={getModeColor(session.mode)}>{session.mode}</Badge>
                          )}
                          {session.webEnabled && (
                            <Badge variant="outline">
                              <Globe className="h-3 w-3 mr-1" />
                              Web
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm">
                        {session.evaluation && (
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            <span>Quality: {formatQualityScore(session.evaluation.qualityScore)}</span>
                          </div>
                        )}
                        {session.domainAgentsUsed.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Database className="h-4 w-4 text-muted-foreground" />
                            <span>{session.domainAgentsUsed.join(", ")}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No sessions found
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Session Detail Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedSession?.title}</DialogTitle>
            <DialogDescription>
              {selectedSession && new Date(selectedSession.createdAt).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1">
            {selectedSession && (
              <div className="space-y-4 pr-4">
                {/* Evaluation Summary */}
                {selectedSession.evaluation && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Quality Evaluation</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Relevance</div>
                          <div className="font-medium">{formatQualityScore(selectedSession.evaluation.relevanceScore)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Groundedness</div>
                          <div className="font-medium">{formatQualityScore(selectedSession.evaluation.groundednessScore)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Coherence</div>
                          <div className="font-medium">{formatQualityScore(selectedSession.evaluation.coherenceScore)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Completeness</div>
                          <div className="font-medium">{formatQualityScore(selectedSession.evaluation.completenessScore)}</div>
                        </div>
                      </div>
                      {selectedSession.evaluation.hallucinationDetected && (
                        <Badge variant="destructive" className="mt-2">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Hallucination Detected
                        </Badge>
                      )}
                      {selectedSession.evaluation.judgeReasoning && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {selectedSession.evaluation.judgeReasoning}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Messages */}
                <div className="space-y-3">
                  {selectedSession.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-3 rounded-lg ${
                        message.role === "user"
                          ? "bg-blue-500/10 border border-blue-500/20"
                          : "bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={message.role === "user" ? "default" : "secondary"}>
                          {message.role}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(message.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
