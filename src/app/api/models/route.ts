import { NextResponse } from "next/server";
import { getAllModelConfigs } from "@/lib/llm/config";

// GET /api/models - List all model configurations
export async function GET() {
  try {
    const configs = await getAllModelConfigs();
    return NextResponse.json(configs);
  } catch (error) {
    console.error("Failed to fetch model configs:", error);
    return NextResponse.json(
      { error: "Failed to fetch model configurations" },
      { status: 500 }
    );
  }
}
