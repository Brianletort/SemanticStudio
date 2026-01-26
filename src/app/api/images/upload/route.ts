import { NextRequest } from 'next/server';
import { uploadImageFile } from '@/lib/llm';
import { db } from '@/lib/db';
import { fileUploads } from '@/lib/db/schema';
import { like } from 'drizzle-orm';

// Maximum file size: 50MB (OpenAI limit)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Allowed MIME types for image uploads
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const sessionId = formData.get('sessionId') as string | null;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ 
        error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB` 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return new Response(JSON.stringify({ 
        error: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}` 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to OpenAI
    const fileId = await uploadImageFile(buffer, file.name, file.type);

    // Save to database
    let dbRecord;
    if (sessionId) {
      try {
        [dbRecord] = await db.insert(fileUploads).values({
          sessionId,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          storagePath: `openai:${fileId}`, // Store OpenAI file ID as storage path
          status: 'uploaded',
          metadata: {
            openaiFileId: fileId,
            purpose: 'vision',
          },
        }).returning();
      } catch (dbError) {
        console.error('Failed to save file record to database:', dbError);
      }
    }

    // Return the file ID and metadata
    return new Response(JSON.stringify({
      success: true,
      fileId,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      dbRecordId: dbRecord?.id,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('File upload error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to upload file',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// GET endpoint to check upload status or get file info
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('fileId');

  if (!fileId) {
    return new Response(JSON.stringify({ error: 'File ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Query database for file info
    // Look for the openai file ID in storage path (stored as openai:{fileId})
    const records = await db.select()
      .from(fileUploads)
      .where(like(fileUploads.storagePath, `%${fileId}%`))
      .limit(1);

    if (records.length === 0) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      file: records[0],
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('File lookup error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to look up file',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
