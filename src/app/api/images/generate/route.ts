import { NextRequest } from 'next/server';
import { generateImageStream, generateImage } from '@/lib/llm';
import { 
  ImageGenerationOptions, 
  ImageQuality, 
  ImageSize, 
  ImageBackground,
  ImageModel,
  ImageInput,
} from '@/lib/llm/types';
import { db } from '@/lib/db';
import { generatedImages, messages } from '@/lib/db/schema';

// Default user ID for development
const DEV_USER_ID = 'dev-user-001';

// Timeout for image generation (3 minutes for complex images)
const IMAGE_GENERATION_TIMEOUT = 180000;

interface GenerateImageRequest {
  prompt: string;
  sessionId?: string;
  messageId?: string;
  quality?: ImageQuality;
  size?: ImageSize;
  background?: ImageBackground;
  model?: ImageModel;
  inputImages?: ImageInput[];
  mask?: ImageInput;
  stream?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as GenerateImageRequest;
    const { 
      prompt, 
      sessionId,
      messageId,
      quality = 'medium', 
      size = '1024x1024', 
      background = 'opaque',
      model = 'gpt-image-1.5',
      inputImages,
      mask,
      stream = true,
    } = body;

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const options: ImageGenerationOptions = {
      quality,
      size,
      background,
      model,
      inputImages,
      mask,
      partialImages: stream ? 2 : 0,
      outputFormat: background === 'transparent' ? 'png' : 'png',
    };

    // Determine action based on whether input images are provided
    if (inputImages && inputImages.length > 0) {
      options.action = 'edit';
      options.inputFidelity = 'high';
    } else {
      options.action = 'generate';
    }

    const startTime = Date.now();
    console.log(`[ImageAPI] Starting image generation - prompt: "${prompt.substring(0, 50)}...", stream: ${stream}, model: ${model}`);

    if (stream) {
      // Streaming response with partial images
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            let finalImageBase64: string | undefined;
            let revisedPrompt: string | undefined;
            let action: 'generate' | 'edit' | undefined;

            // Create abort controller for timeout
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => {
              console.log('[ImageAPI] Timeout reached, aborting...');
              abortController.abort();
            }, IMAGE_GENERATION_TIMEOUT);

            try {
              console.log('[ImageAPI] Starting stream iteration...');
              for await (const event of generateImageStream(prompt, options)) {
                if (abortController.signal.aborted) {
                  console.log('[ImageAPI] Aborted due to timeout');
                  break;
                }

                console.log(`[ImageAPI] Received event: ${event.type}`);

                if (event.type === 'progress') {
                  // Send progress update
                  const data = JSON.stringify({
                    type: 'progress',
                    progress: event.progress,
                  });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                  console.log(`[ImageAPI] Sent progress: ${event.progress}%`);
                } else if (event.type === 'partial') {
                  // Send partial image
                  const data = JSON.stringify({
                    type: 'partial',
                    partialIndex: event.partialImageIndex,
                    imageBase64: event.imageBase64,
                    progress: event.progress,
                  });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                  console.log(`[ImageAPI] Sent partial image ${event.partialImageIndex}`);
                } else if (event.type === 'complete') {
                  finalImageBase64 = event.imageBase64;
                  revisedPrompt = event.revisedPrompt;
                  action = event.action;
                  console.log(`[ImageAPI] Complete event received, image size: ${finalImageBase64?.length || 0} chars`);
                } else if (event.type === 'error') {
                  console.log(`[ImageAPI] Error event: ${event.error}`);
                  const errorData = JSON.stringify({
                    type: 'error',
                    error: event.error,
                  });
                  controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
                }
              }
              console.log('[ImageAPI] Stream iteration completed');
            } finally {
              clearTimeout(timeoutId);
            }

            const durationMs = Date.now() - startTime;

            if (finalImageBase64) {
              // Save to database if session is provided
              let savedImageId: string | undefined;
              if (sessionId) {
                try {
                  const [savedImage] = await db.insert(generatedImages).values({
                    sessionId,
                    messageId: messageId || null,
                    prompt,
                    revisedPrompt: revisedPrompt || null,
                    imageUrl: '', // We store base64 instead
                    model,
                    size,
                    quality,
                  }).returning();
                  savedImageId = savedImage?.id;
                } catch (dbError) {
                  console.error('Failed to save image to database:', dbError);
                }
              }

              // Send final complete image
              const completeData = JSON.stringify({
                type: 'complete',
                imageBase64: finalImageBase64,
                revisedPrompt,
                action,
                imageId: savedImageId,
                durationMs,
                size,
                quality,
                background,
              });
              controller.enqueue(encoder.encode(`data: ${completeData}\n\n`));
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            console.error('Image generation error:', error);
            const errorData = JSON.stringify({
              type: 'error',
              error: error instanceof Error ? error.message : 'Image generation failed',
            });
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // Non-streaming response
      try {
        const result = await generateImage(prompt, options);
        const durationMs = Date.now() - startTime;

        // Save to database if session is provided
        let savedImageId: string | undefined;
        if (sessionId) {
          try {
            const [savedImage] = await db.insert(generatedImages).values({
              sessionId,
              messageId: messageId || null,
              prompt,
              revisedPrompt: result.revisedPrompt || null,
              imageUrl: '', // We store base64 instead
              model,
              size,
              quality,
            }).returning();
            savedImageId = savedImage?.id;
          } catch (dbError) {
            console.error('Failed to save image to database:', dbError);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          imageBase64: result.imageBase64,
          revisedPrompt: result.revisedPrompt,
          action: result.action,
          imageId: savedImageId,
          durationMs,
          size,
          quality,
          background,
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('Image generation error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Image generation failed',
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
  } catch (error) {
    console.error('Request processing error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
