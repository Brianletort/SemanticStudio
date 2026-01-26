import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionFolders, sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/folders/[id] - Get a single folder
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await db
      .select()
      .from(sessionFolders)
      .where(eq(sessionFolders.id, id))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Failed to fetch folder:", error);
    return NextResponse.json(
      { error: "Failed to fetch folder" },
      { status: 500 }
    );
  }
}

// PUT /api/folders/[id] - Update a folder (rename or reorder)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, displayOrder } = body;

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Folder name cannot be empty" },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }

    if (displayOrder !== undefined) {
      if (typeof displayOrder !== "number" || displayOrder < 0) {
        return NextResponse.json(
          { error: "Display order must be a non-negative number" },
          { status: 400 }
        );
      }
      updateData.displayOrder = displayOrder;
    }

    const result = await db
      .update(sessionFolders)
      .set(updateData)
      .where(eq(sessionFolders.id, id))
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Failed to update folder:", error);
    return NextResponse.json(
      { error: "Failed to update folder" },
      { status: 500 }
    );
  }
}

// DELETE /api/folders/[id] - Delete a folder (sessions are moved to "unfiled")
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // First, unassign all sessions from this folder (set folder_id to null)
    // This happens automatically due to ON DELETE SET NULL, but we do it explicitly
    // for clarity and to ensure consistent behavior
    await db
      .update(sessions)
      .set({ folderId: null, updatedAt: new Date() })
      .where(eq(sessions.folderId, id));

    // Then delete the folder
    const result = await db
      .delete(sessionFolders)
      .where(eq(sessionFolders.id, id))
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Failed to delete folder:", error);
    return NextResponse.json(
      { error: "Failed to delete folder" },
      { status: 500 }
    );
  }
}
