import { NextResponse } from "next/server";
import { getProviderStatus } from "@/lib/llm";

// GET /api/models/status - Get provider availability status
export async function GET() {
  try {
    const status = await getProviderStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error("Failed to fetch provider status:", error);
    return NextResponse.json(
      { openai: false, anthropic: false, ollama: false },
      { status: 200 }
    );
  }
}
