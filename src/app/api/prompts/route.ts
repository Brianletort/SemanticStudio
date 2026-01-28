import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { promptLibrary } from '@/lib/db/schema';
import { eq, and, or, isNull, asc } from 'drizzle-orm';

// Default user ID for development
const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

// GET /api/prompts - Get all prompts (system + user's custom + user's edited copies)
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || DEV_USER_ID;
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    // Get all system prompts (where userId is null and isSystem is true)
    // Plus all user prompts (where userId matches)
    let query = db
      .select()
      .from(promptLibrary)
      .where(
        or(
          // System prompts (shared)
          and(isNull(promptLibrary.userId), eq(promptLibrary.isSystem, true)),
          // User's prompts (custom and edited copies)
          eq(promptLibrary.userId, userId)
        )
      )
      .orderBy(asc(promptLibrary.displayOrder), asc(promptLibrary.createdAt));

    const allPrompts = await query;

    // Filter by category if specified
    let filteredPrompts = allPrompts;
    if (category) {
      filteredPrompts = allPrompts.filter(p => p.category === category);
    }

    // Build a map of user's edited system prompts by systemPromptId
    const userEditedMap = new Map<string, typeof allPrompts[0]>();
    for (const p of filteredPrompts) {
      if (p.userId && p.isEdited && p.systemPromptId) {
        userEditedMap.set(p.systemPromptId, p);
      }
    }

    // Merge: for system prompts, use user's edited version if exists
    const mergedPrompts = [];
    const seenSystemPromptIds = new Set<string>();

    for (const p of filteredPrompts) {
      if (!p.userId && p.isSystem) {
        // This is a system prompt - check if user has edited version
        const userEdited = userEditedMap.get(p.id);
        if (userEdited) {
          // Use user's edited version instead
          mergedPrompts.push({
            ...userEdited,
            originalContent: p.content, // Include original for "reset" functionality
          });
          seenSystemPromptIds.add(p.id);
        } else {
          // Use original system prompt
          mergedPrompts.push(p);
        }
      } else if (p.userId && p.isEdited && p.systemPromptId) {
        // User's edited copy - skip if we already added it above
        if (!seenSystemPromptIds.has(p.systemPromptId)) {
          mergedPrompts.push(p);
        }
      } else if (p.userId && !p.isSystem) {
        // User's custom prompt
        mergedPrompts.push(p);
      }
    }

    return NextResponse.json(mergedPrompts);
  } catch (error) {
    console.error('Failed to get prompts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get prompts';
    // Check if it's a table not found error
    if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
      return NextResponse.json({ 
        error: 'Database table not found. Please run the migration: psql $DATABASE_URL -f drizzle/0013_add_prompt_library.sql' 
      }, { status: 500 });
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// POST /api/prompts - Create a new prompt or fork a system prompt for editing
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || DEV_USER_ID;
    const body = await request.json();

    // Validate required fields
    if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!body.content || typeof body.content !== 'string' || body.content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // If forking a system prompt
    if (body.systemPromptId) {
      // Check if user already has an edited copy
      const existing = await db
        .select()
        .from(promptLibrary)
        .where(
          and(
            eq(promptLibrary.userId, userId),
            eq(promptLibrary.systemPromptId, body.systemPromptId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return NextResponse.json(
          { error: 'You already have an edited copy of this prompt' },
          { status: 400 }
        );
      }

      // Create edited copy
      const [prompt] = await db
        .insert(promptLibrary)
        .values({
          userId,
          title: body.title.trim(),
          content: body.content.trim(),
          category: body.category || 'general',
          isSystem: true,
          isEdited: true,
          systemPromptId: body.systemPromptId,
          displayOrder: body.displayOrder || 0,
        })
        .returning();

      return NextResponse.json(prompt);
    }

    // Create new custom prompt
    const [prompt] = await db
      .insert(promptLibrary)
      .values({
        userId,
        title: body.title.trim(),
        content: body.content.trim(),
        category: body.category || 'general',
        isSystem: false,
        isEdited: false,
        displayOrder: body.displayOrder || 100, // Custom prompts go at end
      })
      .returning();

    return NextResponse.json(prompt);
  } catch (error) {
    console.error('Failed to create prompt:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create prompt';
    // Check if it's a table not found error
    if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
      return NextResponse.json({ 
        error: 'Database table not found. Please run the migration: psql $DATABASE_URL -f drizzle/0013_add_prompt_library.sql' 
      }, { status: 500 });
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// PUT /api/prompts - Update a prompt
export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || DEV_USER_ID;
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Prompt ID is required' }, { status: 400 });
    }

    // Check if this is a system prompt being edited by user
    const existing = await db
      .select()
      .from(promptLibrary)
      .where(eq(promptLibrary.id, body.id))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    const prompt = existing[0];

    // If it's a shared system prompt (no userId), create a user copy instead
    if (!prompt.userId && prompt.isSystem) {
      // Check if user already has an edited copy
      const userCopy = await db
        .select()
        .from(promptLibrary)
        .where(
          and(
            eq(promptLibrary.userId, userId),
            eq(promptLibrary.systemPromptId, body.id)
          )
        )
        .limit(1);

      if (userCopy.length > 0) {
        // Update existing user copy
        const [updated] = await db
          .update(promptLibrary)
          .set({
            title: body.title !== undefined ? body.title.trim() : userCopy[0].title,
            content: body.content !== undefined ? body.content.trim() : userCopy[0].content,
            category: body.category !== undefined ? body.category : userCopy[0].category,
            updatedAt: new Date(),
          })
          .where(eq(promptLibrary.id, userCopy[0].id))
          .returning();

        return NextResponse.json({
          ...updated,
          originalContent: prompt.content,
        });
      }

      // Create new user copy
      const [newCopy] = await db
        .insert(promptLibrary)
        .values({
          userId,
          title: body.title !== undefined ? body.title.trim() : prompt.title,
          content: body.content !== undefined ? body.content.trim() : prompt.content,
          category: body.category !== undefined ? body.category : prompt.category,
          isSystem: true,
          isEdited: true,
          systemPromptId: prompt.id,
          displayOrder: prompt.displayOrder,
        })
        .returning();

      return NextResponse.json({
        ...newCopy,
        originalContent: prompt.content,
      });
    }

    // Verify prompt belongs to user (for user prompts)
    if (prompt.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Update user's prompt
    const [updated] = await db
      .update(promptLibrary)
      .set({
        title: body.title !== undefined ? body.title.trim() : prompt.title,
        content: body.content !== undefined ? body.content.trim() : prompt.content,
        category: body.category !== undefined ? body.category : prompt.category,
        updatedAt: new Date(),
      })
      .where(eq(promptLibrary.id, body.id))
      .returning();

    // If this is an edited system prompt, include original content
    if (prompt.isEdited && prompt.systemPromptId) {
      const original = await db
        .select()
        .from(promptLibrary)
        .where(eq(promptLibrary.id, prompt.systemPromptId))
        .limit(1);
      
      if (original.length > 0) {
        return NextResponse.json({
          ...updated,
          originalContent: original[0].content,
        });
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update prompt:', error);
    return NextResponse.json({ error: 'Failed to update prompt' }, { status: 500 });
  }
}

// DELETE /api/prompts - Delete a user prompt or reset edited system prompt
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || DEV_USER_ID;
    const { searchParams } = new URL(request.url);
    const promptId = searchParams.get('id');

    if (!promptId) {
      return NextResponse.json({ error: 'Prompt ID is required' }, { status: 400 });
    }

    // Get the prompt
    const existing = await db
      .select()
      .from(promptLibrary)
      .where(eq(promptLibrary.id, promptId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    const prompt = existing[0];

    // Can't delete shared system prompts
    if (!prompt.userId && prompt.isSystem) {
      return NextResponse.json(
        { error: 'Cannot delete system prompts. You can only edit your copy.' },
        { status: 403 }
      );
    }

    // Verify prompt belongs to user
    if (prompt.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete the prompt (this includes edited copies - "resetting" to default)
    await db.delete(promptLibrary).where(eq(promptLibrary.id, promptId));

    return NextResponse.json({ success: true, wasEditedCopy: prompt.isEdited });
  } catch (error) {
    console.error('Failed to delete prompt:', error);
    return NextResponse.json({ error: 'Failed to delete prompt' }, { status: 500 });
  }
}
