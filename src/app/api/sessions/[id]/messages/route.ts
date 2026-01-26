import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { messages, sessions, generatedImages } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';

// GET /api/sessions/[id]/messages - Get all messages for a session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // First check if session exists
    const sessionCheck = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    
    if (sessionCheck.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get all messages for this session, ordered by creation time
    const result = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, id))
      .orderBy(asc(messages.createdAt));

    // Get all generated images for this session
    const images = await db
      .select()
      .from(generatedImages)
      .where(eq(generatedImages.sessionId, id));
    
    // Create a map of messageId -> image data for quick lookup
    const imagesByMessageId = new Map<string, typeof images[0]>();
    for (const image of images) {
      if (image.messageId) {
        imagesByMessageId.set(image.messageId, image);
      }
    }
    
    // Also create a map by prompt for messages without messageId linkage
    // This handles the case where messages were saved without the messageId reference
    const imagesByPrompt = new Map<string, typeof images[0]>();
    for (const image of images) {
      imagesByPrompt.set(image.prompt, image);
    }

    // Enrich messages with image data
    const enrichedMessages = result.map(msg => {
      const metadata = msg.metadata as Record<string, unknown> | null;
      
      // Check if this is an image generation message
      if (metadata?.imageGeneration) {
        // Try to find the image by messageId first, then by prompt
        const prompt = metadata.prompt as string;
        const image = imagesByMessageId.get(msg.id) || imagesByPrompt.get(prompt);
        
        if (image && image.imageBase64) {
          return {
            ...msg,
            imageGeneration: {
              isGenerating: false,
              progress: 100,
              partialImages: [],
              finalImage: image.imageBase64,
              revisedPrompt: image.revisedPrompt,
              quality: image.quality,
              size: image.size,
              background: image.background,
              durationMs: image.durationMs,
            },
          };
        }
      }
      
      return msg;
    });

    return NextResponse.json(enrichedMessages);
  } catch (error) {
    console.error('Failed to fetch messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// POST /api/sessions/[id]/messages - Add a message to a session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { role, content, metadata } = body;

    // Allow empty content for image generation messages
    const isImageGeneration = metadata?.imageGeneration === true;
    if (!role || (!content && !isImageGeneration)) {
      return NextResponse.json(
        { error: 'role and content are required' },
        { status: 400 }
      );
    }

    if (!['user', 'assistant', 'system'].includes(role)) {
      return NextResponse.json(
        { error: 'role must be one of: user, assistant, system' },
        { status: 400 }
      );
    }

    // Insert the message
    const [message] = await db.insert(messages).values({
      sessionId: id,
      role,
      content: content || '', // Allow empty content for image messages
      metadata: metadata || {},
    }).returning();

    // Update session's updatedAt
    await db.update(sessions)
      .set({ updatedAt: new Date() })
      .where(eq(sessions.id, id));

    return NextResponse.json(message);
  } catch (error) {
    console.error('Failed to add message:', error);
    return NextResponse.json({ error: 'Failed to add message' }, { status: 500 });
  }
}
