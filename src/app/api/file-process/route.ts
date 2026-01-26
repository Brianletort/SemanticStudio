/**
 * File Processing API Route
 * 
 * POST /api/file-process
 * Accepts file uploads and extracts text content for chat context
 * 
 * GET /api/file-process
 * Returns supported file types and limits
 */

import { NextRequest, NextResponse } from 'next/server';
import { processFile, SUPPORTED_MIME_TYPES, FILE_EXTENSION_MAP } from '@/services/file-processor';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds for large files

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('[FileProcess API] Received file upload request');
    
    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      console.log('[FileProcess API] No file in request');
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log('[FileProcess API] File received:', {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      console.log('[FileProcess API] File too large:', file.size);
      return NextResponse.json(
        {
          success: false,
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        },
        { status: 400 }
      );
    }

    // Get MIME type from file or infer from extension
    let mimeType = file.type;
    if (!mimeType || mimeType === 'application/octet-stream') {
      const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
      console.log('[FileProcess API] Inferring MIME from extension:', ext);
      if (ext && FILE_EXTENSION_MAP[ext]) {
        mimeType = FILE_EXTENSION_MAP[ext];
      }
    }

    console.log('[FileProcess API] Using MIME type:', mimeType);

    // Validate MIME type
    if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
      console.log('[FileProcess API] Unsupported MIME type:', mimeType);
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type: ${mimeType}`,
          supportedTypes: Array.from(SUPPORTED_MIME_TYPES),
        },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    console.log('[FileProcess API] Converting file to buffer...');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('[FileProcess API] Buffer size:', buffer.length);

    // Process the file
    console.log('[FileProcess API] Processing file...');
    const result = await processFile(buffer, file.name, mimeType);
    console.log('[FileProcess API] Processing result success:', result.success);

    if (!result.success) {
      console.log('[FileProcess API] Processing failed:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error.message,
          code: result.error.code,
          details: result.error.details,
        },
        { status: 400 }
      );
    }

    const processingTime = Date.now() - startTime;
    console.log(`[FileProcess API] Processed ${file.name} in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      data: {
        id: result.data.id,
        name: result.data.name,
        type: result.data.type,
        size: result.data.size,
        extractedContent: result.data.extractedContent,
        metadata: result.data.metadata,
        processingTimeMs: result.data.processingTimeMs,
        // Include imageData for vision model processing (images only)
        ...(result.data.imageData && { imageData: result.data.imageData }),
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[FileProcess API] Error:', errorMessage);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process file',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/file-process
 * Returns supported file types
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      supportedTypes: Array.from(SUPPORTED_MIME_TYPES),
      maxFileSize: MAX_FILE_SIZE,
      maxFileSizeMB: MAX_FILE_SIZE / (1024 * 1024),
      supportedExtensions: Object.keys(FILE_EXTENSION_MAP),
    },
  });
}
