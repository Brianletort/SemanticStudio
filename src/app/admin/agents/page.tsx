"use client";

import { useState, useEffect } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Search, Users, ShoppingCart, DollarSign, Settings, FileText, Brain } from "lucide-react";
import { toast } from "sonner";

interface DomainAgent {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  status: "active" | "inactive" | "experimental";
  config: Record<string, unknown>;
  systemPrompt?: string;
}

const categoryIcons: Record<string, React.ReactNode> = {
  customer: <Users className="h-4 w-4" />,
  product: <ShoppingCart className="h-4 w-4" />,
  finance: <DollarSign className="h-4 w-4" />,
  operations: <Settings className="h-4 w-4" />,
  people: <Users className="h-4 w-4" />,
  intelligence: <Brain className="h-4 w-4" />,
};

const categoryColors: Record<string, string> = {
  customer: "bg-blue-500/10 text-blue-500",
  product: "bg-purple-500/10 text-purple-500",
  finance: "bg-green-500/10 text-green-500",
  operations: "bg-orange-500/10 text-orange-500",
  people: "bg-pink-500/10 text-pink-500",
  intelligence: "bg-cyan-500/10 text-cyan-500",
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<DomainAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editingAgent, setEditingAgent] = useState<DomainAgent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await fetch("/api/agents");
      if (response.ok) {
        const data = await response.json();
        // Use defaults if database is empty
        if (data.length === 0) {
          setAgents(getDefaultAgents());
        } else {
          setAgents(data);
        }
      } else {
        setAgents(getDefaultAgents());
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error);
      // Use defaults if API fails
      setAgents(getDefaultAgents());
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingAgent) return;

    setSaving(true);
    try {
      const method = isCreating ? "POST" : "PUT";
      const url = isCreating ? "/api/agents" : `/api/agents/${editingAgent.id}`;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingAgent),
      });

      if (response.ok) {
        const saved = await response.json();
        if (isCreating) {
          setAgents((prev) => [...prev, saved]);
        } else {
          setAgents((prev) =>
            prev.map((a) => (a.id === saved.id ? saved : a))
          );
        }
        toast.success(isCreating ? "Agent created" : "Agent updated");
        setEditingAgent(null);
        setIsCreating(false);
      } else {
        toast.error("Failed to save agent");
      }
    } catch (error) {
      console.error("Failed to save agent:", error);
      toast.error("Failed to save agent");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (agent: DomainAgent) => {
    const newStatus = agent.status === "active" ? "inactive" : "active";
    try {
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...agent, status: newStatus }),
      });

      if (response.ok) {
        setAgents((prev) =>
          prev.map((a) =>
            a.id === agent.id ? { ...a, status: newStatus } : a
          )
        );
        toast.success(`Agent ${newStatus === "active" ? "activated" : "deactivated"}`);
      }
    } catch (error) {
      console.error("Failed to toggle status:", error);
      toast.error("Failed to update agent status");
    }
  };

  const filteredAgents = agents.filter((agent) => {
    const matchesSearch =
      agent.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || agent.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(agents.map((a) => a.category))];

  const handleCreateNew = () => {
    setIsCreating(true);
    setEditingAgent({
      id: "",
      name: "",
      displayName: "",
      description: "",
      category: "customer",
      status: "inactive",
      config: {},
      systemPrompt: "",
    });
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <SidebarTrigger />
        <h1 className="font-semibold">Domain Agents</h1>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Manage Domain Agents</h2>
              <p className="text-muted-foreground">
                Configure and manage your specialized domain agents
              </p>
            </div>
            <Button onClick={handleCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
          </div>

          {/* Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Agents Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredAgents.map((agent) => (
                <Card key={agent.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${categoryColors[agent.category] || "bg-gray-500/10 text-gray-500"}`}>
                          {categoryIcons[agent.category] || <FileText className="h-4 w-4" />}
                        </div>
                        <div>
                          <CardTitle className="text-base">{agent.displayName}</CardTitle>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {agent.category}
                          </Badge>
                        </div>
                      </div>
                      <Switch
                        checked={agent.status === "active"}
                        onCheckedChange={() => handleToggleStatus(agent)}
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                      {agent.description || "No description"}
                    </CardDescription>
                    <div className="flex items-center justify-between mt-4">
                      <Badge variant={agent.status === "active" ? "default" : "secondary"}>
                        {agent.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsCreating(false);
                          setEditingAgent(agent);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!loading && filteredAgents.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No agents found</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={!!editingAgent} onOpenChange={(open) => !open && setEditingAgent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isCreating ? "Create Agent" : "Edit Agent"}</DialogTitle>
            <DialogDescription>
              {isCreating
                ? "Create a new domain agent"
                : `Configure the ${editingAgent?.displayName} agent`}
            </DialogDescription>
          </DialogHeader>

          {editingAgent && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name (identifier)</Label>
                  <Input
                    value={editingAgent.name}
                    onChange={(e) =>
                      setEditingAgent({ ...editingAgent, name: e.target.value.toLowerCase().replace(/\s+/g, "_") })
                    }
                    placeholder="customer_agent"
                    disabled={!isCreating}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input
                    value={editingAgent.displayName}
                    onChange={(e) =>
                      setEditingAgent({ ...editingAgent, displayName: e.target.value })
                    }
                    placeholder="Customer Agent"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={editingAgent.category}
                  onValueChange={(value) =>
                    setEditingAgent({ ...editingAgent, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="product">Product & Engineering</SelectItem>
                    <SelectItem value="finance">Finance & Legal</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                    <SelectItem value="people">People</SelectItem>
                    <SelectItem value="intelligence">Intelligence</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editingAgent.description}
                  onChange={(e) =>
                    setEditingAgent({ ...editingAgent, description: e.target.value })
                  }
                  placeholder="Describe what this agent does..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>System Prompt</Label>
                <Textarea
                  value={editingAgent.systemPrompt || ""}
                  onChange={(e) =>
                    setEditingAgent({ ...editingAgent, systemPrompt: e.target.value })
                  }
                  placeholder="You are a helpful assistant that..."
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Define how the agent should behave and what data it has access to
                </p>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editingAgent.status}
                  onValueChange={(value) =>
                    setEditingAgent({ ...editingAgent, status: value as DomainAgent["status"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="experimental">Experimental</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAgent(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isCreating ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getDefaultAgents(): DomainAgent[] {
  return [
    // Customer Domain
    { id: "1", name: "customer", displayName: "Customer", description: "Customer profiles, segments, CLV, and preferences", category: "customer", status: "active", config: {} },
    { id: "2", name: "sales", displayName: "Sales", description: "Pipeline, deals, forecasts, and territories", category: "customer", status: "active", config: {} },
    { id: "3", name: "customer_support", displayName: "Customer Support", description: "Tickets, SLAs, and resolution metrics", category: "customer", status: "active", config: {} },
    { id: "4", name: "customer_success", displayName: "Customer Success", description: "Health scores, churn risk, and renewals", category: "customer", status: "active", config: {} },
    { id: "5", name: "marketing", displayName: "Marketing", description: "Campaigns, leads, conversions, and attribution", category: "customer", status: "active", config: {} },
    
    // Product Domain
    { id: "6", name: "product_management", displayName: "Product Management", description: "Roadmap, features, releases, and feedback", category: "product", status: "active", config: {} },
    { id: "7", name: "engineering", displayName: "Engineering", description: "Sprints, velocity, tech debt, and incidents", category: "product", status: "active", config: {} },
    { id: "8", name: "quality_assurance", displayName: "Quality Assurance", description: "Test coverage, bugs, and release quality", category: "product", status: "active", config: {} },
    { id: "9", name: "design", displayName: "Design", description: "Design system, research, and prototypes", category: "product", status: "active", config: {} },
    { id: "10", name: "data_analytics", displayName: "Data Analytics", description: "Reports, dashboards, and KPI definitions", category: "product", status: "active", config: {} },
    
    // Operations Domain
    { id: "11", name: "operations", displayName: "Operations", description: "Process KPIs, efficiency, and workflows", category: "operations", status: "active", config: {} },
    { id: "12", name: "supply_chain", displayName: "Supply Chain", description: "Suppliers, lead times, and logistics", category: "operations", status: "active", config: {} },
    { id: "13", name: "inventory", displayName: "Inventory", description: "Stock levels, forecasts, and reorder points", category: "operations", status: "active", config: {} },
    { id: "14", name: "procurement", displayName: "Procurement", description: "Vendors, contracts, and spend analysis", category: "operations", status: "active", config: {} },
    { id: "15", name: "facilities", displayName: "Facilities", description: "Locations, maintenance, and assets", category: "operations", status: "active", config: {} },
    
    // Finance Domain
    { id: "16", name: "finance", displayName: "Finance", description: "Budget, P&L, cash flow, and forecasts", category: "finance", status: "active", config: {} },
    { id: "17", name: "accounting", displayName: "Accounting", description: "GL, AR/AP, and reconciliation", category: "finance", status: "active", config: {} },
    { id: "18", name: "legal", displayName: "Legal", description: "Contracts, disputes, and IP portfolio", category: "finance", status: "active", config: {} },
    { id: "19", name: "compliance", displayName: "Compliance", description: "Policies, audits, and certifications", category: "finance", status: "active", config: {} },
    { id: "20", name: "risk_management", displayName: "Risk Management", description: "Risk register, mitigation, and insurance", category: "finance", status: "active", config: {} },
    
    // People Domain
    { id: "21", name: "human_resources", displayName: "Human Resources", description: "Employees, org structure, and benefits", category: "people", status: "active", config: {} },
    { id: "22", name: "talent_acquisition", displayName: "Talent Acquisition", description: "Recruiting, candidates, and offers", category: "people", status: "active", config: {} },
    { id: "23", name: "learning_development", displayName: "Learning & Development", description: "Training, certifications, and skills", category: "people", status: "active", config: {} },
    { id: "24", name: "it_support", displayName: "IT Support", description: "Assets, tickets, and access management", category: "people", status: "active", config: {} },
    { id: "25", name: "communications", displayName: "Communications", description: "Announcements, policies, and events", category: "people", status: "active", config: {} },
    
    // Intelligence Domain
    { id: "26", name: "competitive_intel", displayName: "Competitive Intelligence", description: "Competitors, market trends (unstructured)", category: "intelligence", status: "active", config: {} },
    { id: "27", name: "business_intel", displayName: "Business Intelligence", description: "Cross-domain analytics and insights", category: "intelligence", status: "active", config: {} },
    { id: "28", name: "strategic_planning", displayName: "Strategic Planning", description: "OKRs, initiatives, and priorities", category: "intelligence", status: "active", config: {} },
  ];
}
