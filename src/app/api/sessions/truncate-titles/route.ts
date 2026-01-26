import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

// POST /api/sessions/truncate-titles - Truncate all session titles to 30 chars
export async function POST() {
  try {
    // Update all sessions with titles longer than 30 chars
    const result = await db.execute(sql`
      UPDATE sessions 
      SET title = CASE 
        WHEN LENGTH(title) > 30 THEN LEFT(title, 27) || '...'
        ELSE title
      END
      WHERE LENGTH(title) > 30
    `);
    
    return NextResponse.json({ 
      success: true, 
      message: "Truncated long session titles" 
    });
  } catch (error) {
    console.error("Failed to truncate titles:", error);
    return NextResponse.json(
      { error: "Failed to truncate titles" },
      { status: 500 }
    );
  }
}
