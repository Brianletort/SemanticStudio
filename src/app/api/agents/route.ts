import { NextRequest, NextResponse } from "next/server";
import { db, domainAgents } from "@/lib/db";
import { eq } from "drizzle-orm";

// GET /api/agents - List all domain agents
export async function GET() {
  try {
    const agents = await db.select().from(domainAgents);
    
    // If no agents in DB, return empty array (will use client defaults)
    if (agents.length === 0) {
      return NextResponse.json([]);
    }
    
    return NextResponse.json(agents);
  } catch (error) {
    console.error("Failed to fetch agents:", error);
    return NextResponse.json([], { status: 200 });
  }
}

// POST /api/agents - Create a new domain agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, displayName, description, category, status, config, systemPrompt } = body;

    const [newAgent] = await db
      .insert(domainAgents)
      .values({
        name,
        displayName,
        description,
        category,
        status: status || "inactive",
        config: config || {},
        systemPrompt,
      })
      .returning();

    return NextResponse.json(newAgent);
  } catch (error) {
    console.error("Failed to create agent:", error);
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }
}
