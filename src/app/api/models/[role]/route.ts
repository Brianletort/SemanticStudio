import { NextRequest, NextResponse } from "next/server";
import { updateModelConfig } from "@/lib/llm/config";
import type { ModelRole } from "@/lib/llm/types";

// PUT /api/models/[role] - Update a model configuration
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ role: string }> }
) {
  try {
    const { role } = await params;
    const body = await request.json();
    const { provider, modelName, config, fallbackProvider, fallbackModel } = body;

    const updated = await updateModelConfig(role as ModelRole, {
      provider,
      modelName,
      config,
      fallbackProvider,
      fallbackModel,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update model config:", error);
    return NextResponse.json(
      { error: "Failed to update model configuration" },
      { status: 500 }
    );
  }
}
