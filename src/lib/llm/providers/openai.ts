import OpenAI from 'openai';
import { 
  LLMProvider, 
  ChatMessage, 
  ChatOptions, 
  ChatResponse, 
  EmbeddingOptions,
  ImageGenerationOptions,
  GeneratedImage,
  ImageStreamEvent,
  ImageInput,
} from '../types';

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResponse> {
    const response = await this.client.chat.completions.create({
      model: options.model || 'gpt-5-mini',
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      response_format: options.responseFormat === 'json' ? { type: 'json_object' } : undefined,
    });

    return {
      content: response.choices[0]?.message?.content || '',
      model: response.model,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    };
  }

  async *streamChat(messages: ChatMessage[], options: ChatOptions = {}): AsyncGenerator<string, void, unknown> {
    const stream = await this.client.chat.completions.create({
      model: options.model || 'gpt-5-mini',
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  async embed(text: string | string[], options: EmbeddingOptions = {}): Promise<number[][]> {
    const input = Array.isArray(text) ? text : [text];
    
    const response = await this.client.embeddings.create({
      model: options.model || 'text-embedding-3-large',
      input,
      dimensions: options.dimensions || 1536,
    });

    return response.data.map(d => d.embedding);
  }

  /**
   * Generate an image using OpenAI's images.generate() API
   * Returns base64-encoded image data
   */
  async generateImage(prompt: string, options: ImageGenerationOptions = {}): Promise<GeneratedImage> {
    const size = options.size || '1024x1024';
    const quality = options.quality || 'medium';
    
    console.log(`[OpenAI] Generating image with model=${options.model || 'gpt-image-1.5'}, size=${size}, quality=${quality}`);
    
    try {
      // Check if this is an edit operation with input images
      if (options.inputImages && options.inputImages.length > 0 && options.action === 'edit') {
        return await this.editImage(prompt, options);
      }
      
      // Standard text-to-image generation using images.generate()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await this.client.images.generate({
        model: options.model || 'gpt-image-1.5',
        prompt,
        n: 1,
        size: size as '1024x1024' | '1536x1024' | '1024x1536',
        quality: quality as 'low' | 'medium' | 'high',
      } as any);

      if (!response.data || response.data.length === 0) {
        throw new Error('No image data returned from OpenAI');
      }

      const imageData = response.data[0];
      
      // Handle both URL and base64 response formats
      const imageBase64 = imageData.b64_json || '';
      const imageUrl = imageData.url;
      
      console.log(`[OpenAI] Image generated successfully. Has b64: ${!!imageData.b64_json}, Has URL: ${!!imageData.url}`);

      return {
        imageBase64: imageBase64 || (imageUrl ? `URL:${imageUrl}` : ''),
        revisedPrompt: imageData.revised_prompt,
        action: 'generate',
        size,
        quality,
        background: options.background || 'opaque',
      };
    } catch (error) {
      console.error('[OpenAI] Image generation failed:', error);
      throw error;
    }
  }

  /**
   * Edit an existing image using OpenAI's images.edit() API
   */
  private async editImage(prompt: string, options: ImageGenerationOptions): Promise<GeneratedImage> {
    if (!options.inputImages || options.inputImages.length === 0) {
      throw new Error('Input images required for image editing');
    }

    const inputImage = options.inputImages[0];
    
    console.log(`[OpenAI] Editing image with type=${inputImage.type}`);
    
    // Convert input image to File object for the API
    let imageFile: File;
    
    if (inputImage.type === 'base64') {
      const imageBuffer = Buffer.from(inputImage.value, 'base64');
      const blob = new Blob([imageBuffer], { type: inputImage.mimeType || 'image/png' });
      imageFile = new File([blob], 'input.png', { type: 'image/png' });
    } else if (inputImage.type === 'url') {
      // Fetch the image from URL
      const response = await fetch(inputImage.value);
      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'image/png' });
      imageFile = new File([blob], 'input.png', { type: 'image/png' });
    } else {
      throw new Error('File ID input not supported for image editing');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await this.client.images.edit({
      model: 'gpt-image-1.5',
      image: imageFile,
      prompt,
      n: 1,
      size: (options.size || '1024x1024') as '1024x1024',
    } as any);

    if (!response.data || response.data.length === 0) {
      throw new Error('No image data returned from OpenAI edit');
    }

    const imageData = response.data[0];
    
    return {
      imageBase64: imageData.b64_json || '',
      revisedPrompt: imageData.revised_prompt,
      action: 'edit',
      size: options.size || '1024x1024',
      quality: options.quality || 'medium',
      background: options.background || 'opaque',
    };
  }

  /**
   * Generate image with native OpenAI streaming support
   * Yields partial images as they're generated, then the final result
   */
  async *generateImageStream(
    prompt: string,
    options: ImageGenerationOptions = {}
  ): AsyncGenerator<ImageStreamEvent, void, unknown> {
    const size = options.size || '1024x1024';
    const quality = options.quality || 'medium';
    
    console.log(`[OpenAI] Starting streaming image generation with model=${options.model || 'gpt-image-1.5'}, size=${size}, quality=${quality}`);
    
    try {
      // Check if this is an edit operation - fall back to non-streaming for edits
      if (options.inputImages && options.inputImages.length > 0 && options.action === 'edit') {
        console.log('[OpenAI] Edit mode detected, using non-streaming fallback');
        yield { type: 'progress', progress: 10 };
        const result = await this.editImage(prompt, options);
        yield { type: 'progress', progress: 90 };
        yield {
          type: 'complete',
          imageBase64: result.imageBase64,
          revisedPrompt: result.revisedPrompt,
          action: result.action,
          progress: 100,
        };
        return;
      }
      
      // Use native streaming API for generation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream = await this.client.images.generate({
        model: options.model || 'gpt-image-1.5',
        prompt,
        n: 1,
        size: size as '1024x1024' | '1536x1024' | '1024x1536',
        quality: quality as 'low' | 'medium' | 'high',
        stream: true,
      } as any);

      let partialCount = 0;
      
      console.log('[OpenAI] Stream started, waiting for events...');
      
      for await (const event of stream) {
        console.log(`[OpenAI] Received stream event:`, Object.keys(event));
        
        // Check if this is a partial image event
        if ('partial_image_index' in event) {
          partialCount++;
          console.log(`[OpenAI] Partial image ${event.partial_image_index} received`);
          yield {
            type: 'partial',
            partialImageIndex: event.partial_image_index,
            imageBase64: event.b64_json,
            progress: Math.min(90, partialCount * 30),
          };
        } else if ('b64_json' in event) {
          // Completed event
          console.log('[OpenAI] Final image received');
          yield {
            type: 'complete',
            imageBase64: event.b64_json,
            revisedPrompt: event.revised_prompt,
            action: 'generate',
            progress: 100,
          };
        }
      }
      
      console.log('[OpenAI] Stream completed');
    } catch (error) {
      console.error('[OpenAI] Streaming image generation failed:', error);
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Image generation failed',
      };
    }
  }

  /**
   * Upload a file to OpenAI for use in image editing
   */
  async uploadFile(file: Buffer, filename: string, mimeType: string): Promise<string> {
    // Create ArrayBuffer from Buffer for Blob compatibility
    const arrayBuffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: mimeType });
    const fileObj = new File([blob], filename, { type: mimeType });

    const response = await this.client.files.create({
      file: fileObj,
      purpose: 'vision',
    });

    return response.id;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.models.list();
      return response.data
        .filter(m => m.id.includes('gpt') || m.id.includes('embedding') || m.id.includes('image'))
        .map(m => m.id)
        .sort();
    } catch {
      return [];
    }
  }
}
