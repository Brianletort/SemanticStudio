import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userSettings, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Default user ID for development (matches init.sql)
const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

// Conversation style descriptions for reference
export const CONVERSATION_STYLES = {
  professional: 'Formal, business-appropriate tone',
  friendly: 'Warm and approachable',
  candid: 'Direct and honest',
  efficient: 'Brief and to the point',
  quirky: 'Playful and creative',
  nerdy: 'Technical and detailed',
  cynical: 'Dry humor, realistic',
} as const;

// Characteristic options
export const CHARACTERISTICS = {
  use_emojis: 'Include emojis in responses',
  use_headers: 'Use headers and lists for structure',
  enthusiastic: 'Upbeat and energetic tone',
  formal: 'Use formal language',
  detailed: 'Provide comprehensive explanations',
} as const;

// Memory extraction modes
export const MEMORY_EXTRACTION_MODES = {
  conservative: 'Only save explicitly important facts',
  balanced: 'Balance between saving and not overwhelming',
  aggressive: 'Save as many relevant facts as possible',
} as const;

export type ConversationStyle = keyof typeof CONVERSATION_STYLES;
export type Characteristic = keyof typeof CHARACTERISTICS;
export type MemoryExtractionMode = keyof typeof MEMORY_EXTRACTION_MODES;

// GET /api/settings - Get user settings
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || DEV_USER_ID;

    // Try to get existing settings
    const settings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (settings.length > 0) {
      return NextResponse.json(settings[0]);
    }

    // Create default settings if none exist
    const [newSettings] = await db
      .insert(userSettings)
      .values({
        userId,
        theme: 'system',
        conversationStyle: 'professional',
        characteristics: {
          use_emojis: false,
          use_headers: true,
          enthusiastic: false,
          formal: false,
          detailed: true,
        },
        // Memory configuration defaults
        memoryEnabled: true,
        referenceSavedMemories: true,
        referenceChatHistory: true,
        autoSaveMemories: true,
        memoryExtractionMode: 'balanced',
        maxMemoriesInContext: 10,
        includeSessionSummaries: false,
        // Chat organization defaults
        maxPinnedSessions: 10,
      })
      .returning();

    return NextResponse.json(newSettings);
  } catch (error) {
    console.error('Failed to get settings:', error);
    return NextResponse.json({ error: 'Failed to get settings' }, { status: 500 });
  }
}

// PUT /api/settings - Update user settings
export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || DEV_USER_ID;
    const body = await request.json();

    // Validate theme
    if (body.theme && !['light', 'dark', 'system'].includes(body.theme)) {
      return NextResponse.json({ error: 'Invalid theme' }, { status: 400 });
    }

    // Validate conversation style
    if (body.conversationStyle && !Object.keys(CONVERSATION_STYLES).includes(body.conversationStyle)) {
      return NextResponse.json({ error: 'Invalid conversation style' }, { status: 400 });
    }

    // Validate memory extraction mode
    if (body.memoryExtractionMode && !Object.keys(MEMORY_EXTRACTION_MODES).includes(body.memoryExtractionMode)) {
      return NextResponse.json({ error: 'Invalid memory extraction mode' }, { status: 400 });
    }

    // Validate max memories in context
    if (body.maxMemoriesInContext !== undefined && (body.maxMemoriesInContext < 0 || body.maxMemoriesInContext > 100)) {
      return NextResponse.json({ error: 'maxMemoriesInContext must be between 0 and 100' }, { status: 400 });
    }

    // Validate max pinned sessions
    if (body.maxPinnedSessions !== undefined && (body.maxPinnedSessions < 1 || body.maxPinnedSessions > 50)) {
      return NextResponse.json({ error: 'maxPinnedSessions must be between 1 and 50' }, { status: 400 });
    }

    // Check if settings exist
    const existing = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    let result;
    if (existing.length > 0) {
      // Update existing
      const [updated] = await db
        .update(userSettings)
        .set({
          theme: body.theme ?? existing[0].theme,
          nickname: body.nickname ?? existing[0].nickname,
          occupation: body.occupation ?? existing[0].occupation,
          aboutMe: body.aboutMe ?? existing[0].aboutMe,
          conversationStyle: body.conversationStyle ?? existing[0].conversationStyle,
          characteristics: body.characteristics ?? existing[0].characteristics,
          // Memory configuration
          memoryEnabled: body.memoryEnabled ?? existing[0].memoryEnabled,
          referenceSavedMemories: body.referenceSavedMemories ?? existing[0].referenceSavedMemories,
          referenceChatHistory: body.referenceChatHistory ?? existing[0].referenceChatHistory,
          autoSaveMemories: body.autoSaveMemories ?? existing[0].autoSaveMemories,
          memoryExtractionMode: body.memoryExtractionMode ?? existing[0].memoryExtractionMode,
          maxMemoriesInContext: body.maxMemoriesInContext ?? existing[0].maxMemoriesInContext,
          includeSessionSummaries: body.includeSessionSummaries ?? existing[0].includeSessionSummaries,
          // Chat organization
          maxPinnedSessions: body.maxPinnedSessions ?? existing[0].maxPinnedSessions,
          updatedAt: new Date(),
        })
        .where(eq(userSettings.userId, userId))
        .returning();
      result = updated;
    } else {
      // Create new
      const [created] = await db
        .insert(userSettings)
        .values({
          userId,
          theme: body.theme || 'system',
          nickname: body.nickname,
          occupation: body.occupation,
          aboutMe: body.aboutMe,
          conversationStyle: body.conversationStyle || 'professional',
          characteristics: body.characteristics || {
            use_emojis: false,
            use_headers: true,
            enthusiastic: false,
            formal: false,
            detailed: true,
          },
          // Memory configuration (use defaults if not provided)
          memoryEnabled: body.memoryEnabled ?? true,
          referenceSavedMemories: body.referenceSavedMemories ?? true,
          referenceChatHistory: body.referenceChatHistory ?? true,
          autoSaveMemories: body.autoSaveMemories ?? true,
          memoryExtractionMode: body.memoryExtractionMode || 'balanced',
          maxMemoriesInContext: body.maxMemoriesInContext ?? 10,
          includeSessionSummaries: body.includeSessionSummaries ?? false,
          // Chat organization
          maxPinnedSessions: body.maxPinnedSessions ?? 10,
        })
        .returning();
      result = created;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to update settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
