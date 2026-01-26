import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionFolders } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

// Default user ID for development (matches init.sql)
const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

// GET /api/folders - List all folders for the current user
export async function GET() {
  try {
    const folders = await db
      .select()
      .from(sessionFolders)
      .where(eq(sessionFolders.userId, DEV_USER_ID))
      .orderBy(asc(sessionFolders.displayOrder), asc(sessionFolders.name));

    return NextResponse.json(folders);
  } catch (error) {
    console.error("Failed to fetch folders:", error);
    return NextResponse.json(
      { error: "Failed to fetch folders" },
      { status: 500 }
    );
  }
}

// POST /api/folders - Create a new folder
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Folder name is required" },
        { status: 400 }
      );
    }

    // Get the max display order to add new folder at the end
    const existingFolders = await db
      .select({ displayOrder: sessionFolders.displayOrder })
      .from(sessionFolders)
      .where(eq(sessionFolders.userId, DEV_USER_ID))
      .orderBy(asc(sessionFolders.displayOrder));

    const maxOrder = existingFolders.length > 0 
      ? Math.max(...existingFolders.map(f => f.displayOrder ?? 0))
      : -1;

    const [newFolder] = await db
      .insert(sessionFolders)
      .values({
        userId: DEV_USER_ID,
        name: name.trim(),
        displayOrder: maxOrder + 1,
      })
      .returning();

    return NextResponse.json(newFolder);
  } catch (error) {
    console.error("Failed to create folder:", error);
    return NextResponse.json(
      { error: "Failed to create folder" },
      { status: 500 }
    );
  }
}
