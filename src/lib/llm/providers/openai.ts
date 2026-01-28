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
  DeepResearchOptions,
  DeepResearchResponse,
  DeepResearchStatus,
  ResponsesTool,
} from '../types';

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Format messages for the Responses API input
   */
  private formatMessagesForResponses(messages: ChatMessage[]): string {
    // For simple cases, concatenate messages with role prefixes
    // The Responses API accepts a string or structured input
    const parts: string[] = [];
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        // System messages are handled via instructions parameter
        continue;
      } else if (msg.role === 'user') {
        parts.push(msg.content);
      } else if (msg.role === 'assistant') {
        parts.push(`Assistant: ${msg.content}`);
      }
    }
    
    return parts.join('\n\n');
  }

  /**
   * Extract system message for use as instructions
   */
  private extractSystemMessage(messages: ChatMessage[]): string | undefined {
    const systemMsg = messages.find(m => m.role === 'system');
    return systemMsg?.content;
  }

  /**
   * Convert our tool format to OpenAI Responses API format
   */
  private formatToolsForResponses(tools?: ResponsesTool[]): unknown[] | undefined {
    if (!tools || tools.length === 0) return undefined;
    
    return tools.map(tool => {
      if (tool.type === 'function' && tool.function) {
        return {
          type: 'function',
          function: tool.function,
        };
      }
      // web_search_preview, file_search, mcp, code_interpreter pass through
      return tool;
    });
  }

  /**
   * Chat using the Responses API
   * This replaces the Chat Completions API for better tool support
   */
  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResponse> {
    const input = this.formatMessagesForResponses(messages);
    const instructions = options.instructions || this.extractSystemMessage(messages);
    
    // Build request parameters
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestParams: any = {
      model: options.model || 'gpt-5-mini',
      input,
    };

    // Add optional parameters
    if (instructions) {
      requestParams.instructions = instructions;
    }
    
    if (options.reasoning) {
      requestParams.reasoning = options.reasoning;
    }
    
    if (options.verbosity) {
      requestParams.text = { verbosity: options.verbosity };
    }
    
    if (options.tools && options.tools.length > 0) {
      requestParams.tools = this.formatToolsForResponses(options.tools);
    }
    
    if (options.maxTokens) {
      requestParams.max_output_tokens = options.maxTokens;
    }

    console.log(`[OpenAI] Responses API call with model=${requestParams.model}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (this.client as any).responses.create(requestParams);

    console.log(`[OpenAI] output_text: "${response.output_text?.substring(0, 100)}"`);
    console.log(`[OpenAI] output items: ${response.output?.length}`);
    if (response.output) {
      for (const item of response.output) {
        console.log(`[OpenAI] Output item type=${item.type}, content=${JSON.stringify(item.content || item.text || item.summary || 'none').substring(0, 200)}`);
      }
    }

    // Extract tool calls from output if present
    const toolCalls = response.output
      ?.filter((item: { type: string }) => item.type === 'function_call' || item.type === 'tool_use')
      ?.map((item: { type: string; name?: string; arguments?: unknown }) => ({
        type: item.type,
        name: item.name,
        arguments: item.arguments,
      }));

    return {
      content: response.output_text || '',
      model: response.model || requestParams.model,
      responseId: response.id,
      usage: response.usage ? {
        promptTokens: response.usage.input_tokens || 0,
        completionTokens: response.usage.output_tokens || 0,
        totalTokens: response.usage.total_tokens || 0,
      } : undefined,
      toolCalls: toolCalls?.length > 0 ? toolCalls : undefined,
    };
  }

  /**
   * Streaming chat using the Responses API
   */
  async *streamChat(messages: ChatMessage[], options: ChatOptions = {}): AsyncGenerator<string, void, unknown> {
    const input = this.formatMessagesForResponses(messages);
    const instructions = options.instructions || this.extractSystemMessage(messages);
    
    // Build request parameters
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestParams: any = {
      model: options.model || 'gpt-5-mini',
      input,
      stream: true,
    };

    if (instructions) {
      requestParams.instructions = instructions;
    }
    
    if (options.reasoning) {
      requestParams.reasoning = options.reasoning;
    }
    
    if (options.verbosity) {
      requestParams.text = { verbosity: options.verbosity };
    }
    
    if (options.tools && options.tools.length > 0) {
      requestParams.tools = this.formatToolsForResponses(options.tools);
    }
    
    if (options.maxTokens) {
      requestParams.max_output_tokens = options.maxTokens;
    }

    console.log(`[OpenAI] Responses API streaming call with model=${requestParams.model}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = await (this.client as any).responses.create(requestParams);

    for await (const event of stream) {
      // Handle different event types from Responses API streaming
      if (event.type === 'response.output_text.delta') {
        yield event.delta || '';
      } else if (event.type === 'response.text.delta') {
        yield event.delta || '';
      } else if (event.delta) {
        // Fallback for any delta content
        yield event.delta;
      }
    }
  }

  /**
   * Deep research using o3-deep-research model
   * Uses background mode for long-running requests (up to 30 minutes)
   */
  async deepResearch(input: string, options: DeepResearchOptions = {}): Promise<DeepResearchResponse> {
    console.log(`[OpenAI] Starting deep research with background=${options.background ?? true}`);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestParams: any = {
      model: 'o3-deep-research',
      input,
      background: options.background ?? true,  // Default to background mode
      tools: [
        { type: 'web_search_preview' },  // Always enable web search for research
      ],
    };

    if (options.instructions) {
      requestParams.instructions = options.instructions;
    }

    if (options.maxToolCalls) {
      requestParams.max_tool_calls = options.maxToolCalls;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (this.client as any).responses.create(requestParams);

    console.log(`[OpenAI] Deep research job created: ${response.id}, status: ${response.status}`);

    return {
      id: response.id,
      status: response.status,
      output_text: response.output_text,
      output: response.output,
    };
  }

  /**
   * Get status of a background response (for polling deep research jobs)
   */
  async getResponseStatus(responseId: string): Promise<DeepResearchStatus> {
    console.log(`[OpenAI] Checking response status for: ${responseId}`);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (this.client as any).responses.retrieve(responseId);

    // Debug logging for response structure
    console.log(`[OpenAI] Response status: ${response.status}, output items: ${response.output?.length || 0}`);
    if (response.output && response.output.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemTypes = response.output.map((i: any) => i.type).join(', ');
      console.log(`[OpenAI] Output item types: ${itemTypes}`);
    }

    // Count web search calls and sources found from output
    let sourcesFound = 0;
    let searchesCompleted = 0;
    
    if (response.output) {
      for (const item of response.output) {
        if (item.type === 'web_search_call') {
          searchesCompleted++;
          if (item.status === 'completed') {
            sourcesFound++;
          }
        }
      }
    }
    
    console.log(`[OpenAI] Progress: ${searchesCompleted} searches, ${sourcesFound} sources found`);

    return {
      id: response.id,
      status: response.status,
      output_text: response.output_text,
      output: response.output,
      sourcesFound,
      searchesCompleted,
    };
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
    const outputFormat = options.outputFormat || 'png';
    const background = options.background || 'opaque';
    
    console.log(`[OpenAI] Generating image with model=${options.model || 'gpt-image-1.5'}, size=${size}, quality=${quality}, format=${outputFormat}`);
    
    try {
      // Check if this is an edit operation with input images
      if (options.inputImages && options.inputImages.length > 0 && options.action === 'edit') {
        return await this.editImage(prompt, options);
      }
      
      // Standard text-to-image generation using images.generate()
      // GPT image models always return base64 (no response_format needed)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await this.client.images.generate({
        model: options.model || 'gpt-image-1.5',
        prompt,
        n: 1,
        size: size as '1024x1024' | '1536x1024' | '1024x1536',
        quality: quality as 'low' | 'medium' | 'high',
        output_format: outputFormat,
        background: background,
      } as any);

      if (!response.data || response.data.length === 0) {
        throw new Error('No image data returned from OpenAI');
      }

      const imageData = response.data[0];
      
      // GPT image models always return base64
      const imageBase64 = imageData.b64_json || '';
      
      console.log(`[OpenAI] Image generated successfully. Has b64: ${!!imageData.b64_json}, size: ${imageBase64.length} chars`);

      return {
        imageBase64,
        revisedPrompt: imageData.revised_prompt,
        action: 'generate',
        size,
        quality,
        background,
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
    const size = options.size || '1024x1024';
    const quality = options.quality || 'medium';
    const outputFormat = options.outputFormat || 'png';
    const background = options.background || 'opaque';
    
    console.log(`[OpenAI] Editing image with type=${inputImage.type}, size=${size}, format=${outputFormat}`);
    
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
    } else if (inputImage.type === 'file_id') {
      // Fetch file content from OpenAI Files API
      console.log(`[OpenAI] Fetching file content for file_id: ${inputImage.value}`);
      const fileResponse = await this.client.files.content(inputImage.value);
      const arrayBuffer = await fileResponse.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: inputImage.mimeType || 'image/png' });
      imageFile = new File([blob], 'input.png', { type: 'image/png' });
    } else {
      throw new Error(`Unsupported input image type: ${inputImage.type}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await this.client.images.edit({
      model: 'gpt-image-1.5',
      image: imageFile,
      prompt,
      n: 1,
      size: size as '1024x1024' | '1536x1024' | '1024x1536',
      quality: quality as 'low' | 'medium' | 'high',
      output_format: outputFormat,
      background: background,
    } as any);

    if (!response.data || response.data.length === 0) {
      throw new Error('No image data returned from OpenAI edit');
    }

    const imageData = response.data[0];
    
    return {
      imageBase64: imageData.b64_json || '',
      revisedPrompt: imageData.revised_prompt,
      action: 'edit',
      size,
      quality,
      background,
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
    const outputFormat = options.outputFormat || 'png';
    const background = options.background || 'opaque';
    // partial_images is REQUIRED for streaming - must be 1-3
    const partialImages = options.partialImages || 2;
    
    console.log(`[OpenAI] Starting streaming image generation with model=${options.model || 'gpt-image-1.5'}, size=${size}, quality=${quality}, partialImages=${partialImages}`);
    
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
        output_format: outputFormat,
        background: background,
        partial_images: partialImages,
        stream: true,
      } as any);

      let partialCount = 0;
      
      console.log('[OpenAI] Stream started, waiting for events...');
      
      for await (const event of stream) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const evt = event as any;
        console.log(`[OpenAI] Received stream event type: ${evt.type}`);
        
        // Check event type per OpenAI API spec
        if (evt.type === 'image_generation.partial_image') {
          partialCount++;
          console.log(`[OpenAI] Partial image ${evt.partial_image_index} received`);
          yield {
            type: 'partial',
            partialImageIndex: evt.partial_image_index,
            imageBase64: evt.b64_json,
            progress: Math.min(90, partialCount * 30),
          };
        } else if (evt.type === 'image_generation.completed') {
          // Completed event
          console.log('[OpenAI] Final image received');
          yield {
            type: 'complete',
            imageBase64: evt.b64_json,
            revisedPrompt: evt.revised_prompt,
            action: 'generate',
            progress: 100,
          };
        } else if ('partial_image_index' in evt) {
          // Fallback for legacy event format
          partialCount++;
          console.log(`[OpenAI] Partial image (legacy) ${evt.partial_image_index} received`);
          yield {
            type: 'partial',
            partialImageIndex: evt.partial_image_index,
            imageBase64: evt.b64_json,
            progress: Math.min(90, partialCount * 30),
          };
        } else if ('b64_json' in evt && !evt.type) {
          // Fallback for legacy completed event
          console.log('[OpenAI] Final image (legacy) received');
          yield {
            type: 'complete',
            imageBase64: evt.b64_json,
            revisedPrompt: evt.revised_prompt,
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
