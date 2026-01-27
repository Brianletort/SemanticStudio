import { NextRequest } from "next/server";
import { streamChat, generateImage, deepResearch, getDeepResearchStatus } from "@/lib/llm";
import { domainRetriever } from "@/lib/retrieval";
import { braveSearch, formatSearchResultsForContext, isBraveSearchConfigured } from "@/lib/search";
import { db } from "@/lib/db";
import { userSettings, messages as messagesTable } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import type { ChatMessage, ModelRole } from "@/lib/llm/types";
import type { RetrievalMode } from "@/lib/retrieval";
import { 
  MemoryService, 
  formatMemoryContext, 
  MemoryConfig, 
  MemoryContext,
  DEFAULT_MEMORY_CONFIG,
  MemoryExtractionMode
} from "@/lib/memory";
import {
  classifyQueryMode,
  createEventBus,
  evaluateAndSaveResponse,
  detectImageRequest,
  extractImagePrompt,
  getModeConfig,
  getResolvedModeConfig,
  DEFAULT_MODE_CONFIGS,
  createClarificationAgent,
  type ChatMode,
  type AgentEvent,
  type ModeClassification,
  type ModeConfig,
  type ModeSettingsOverrides,
  type MemoryTierConfig,
  type PipelineConfig,
} from "@/lib/chat";
import { v4 as uuidv4 } from "uuid";
import { isValidUUID } from "@/lib/utils";

export const runtime = "nodejs";
// Research mode can take up to 30 minutes, so we set a high max duration
// Other modes will complete much faster but this allows for long research jobs
export const maxDuration = 1800; // 30 minutes

// Default user ID for development
const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

// Conversation style instructions
const STYLE_INSTRUCTIONS: Record<string, string> = {
  professional: "Communicate in a formal, business-appropriate manner.",
  friendly: "Be warm, approachable, and conversational.",
  candid: "Be direct, honest, and straightforward.",
  efficient: "Keep responses brief and to the point.",
  quirky: "Be playful, creative, and add personality.",
  nerdy: "Be technical, detailed, and precise.",
  cynical: "Use dry humor and maintain a realistic perspective.",
};

// Helper to build personalization context (user profile and style only)
function buildPersonalizationContext(
  settings: {
    nickname: string | null;
    occupation: string | null;
    aboutMe: string | null;
    conversationStyle: string | null;
    characteristics: Record<string, boolean> | null;
  } | null
): string {
  const parts: string[] = [];

  if (settings) {
    parts.push("## User Personalization");
    
    // Profile
    if (settings.nickname || settings.occupation || settings.aboutMe) {
      parts.push("\n### User Profile");
      if (settings.nickname) parts.push(`- Address them as: ${settings.nickname}`);
      if (settings.occupation) parts.push(`- Occupation: ${settings.occupation}`);
      if (settings.aboutMe) parts.push(`- About them: ${settings.aboutMe}`);
    }

    // Conversation style
    if (settings.conversationStyle) {
      const styleInstruction = STYLE_INSTRUCTIONS[settings.conversationStyle] || "";
      parts.push(`\n### Communication Style`);
      parts.push(`Style: ${settings.conversationStyle}. ${styleInstruction}`);
    }

    // Characteristics
    if (settings.characteristics) {
      const chars = settings.characteristics;
      const charInstructions: string[] = [];
      
      if (chars.use_emojis) charInstructions.push("Include relevant emojis in responses");
      else charInstructions.push("Do not use emojis");
      
      if (chars.use_headers) charInstructions.push("Use headers and lists for structure");
      else charInstructions.push("Use flowing prose instead of headers/lists");
      
      if (chars.enthusiastic) charInstructions.push("Be upbeat and energetic");
      if (chars.formal) charInstructions.push("Use formal language patterns");
      if (chars.detailed) charInstructions.push("Provide comprehensive explanations");
      else charInstructions.push("Keep explanations concise");
      
      if (charInstructions.length > 0) {
        parts.push(`\n### Response Formatting`);
        charInstructions.forEach(inst => parts.push(`- ${inst}`));
      }
    }
  }

  return parts.length > 0 ? parts.join("\n") : "";
}

// Attachment type for uploaded files
interface FileAttachmentData {
  id: string;
  name: string;
  type: string;
  extractedContent?: string;
  imageData?: string;
}

// Helper to build file context from attachments
function buildFileContext(attachments: FileAttachmentData[]): string {
  if (!attachments || attachments.length === 0) return "";
  
  const maxContentPerFile = 50000; // Truncate to 50K chars per file
  
  const fileContextParts = attachments
    .filter(a => a.extractedContent)
    .map(a => {
      const content = a.extractedContent!.length > maxContentPerFile
        ? a.extractedContent!.substring(0, maxContentPerFile) + '\n[Content truncated...]'
        : a.extractedContent!;
      return `=== FILE: ${a.name} (${a.type}) ===\n${content}\n=== END FILE ===`;
    });
  
  if (fileContextParts.length === 0) return "";
  
  return `## Uploaded Files Context\n\nThe user has uploaded the following file(s) for context:\n\n${fileContextParts.join('\n\n')}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, sessionId, mode: requestedMode = "think", imageMode = false, webEnabled = false, attachments = [] } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate sessionId if provided
    if (sessionId && !isValidUUID(sessionId)) {
      return new Response(JSON.stringify({ error: "Invalid session ID format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generate unique IDs for this request
    const runId = uuidv4();
    const turnId = uuidv4();

    // Auto-detect image generation requests in regular chat
    const autoDetectedImageMode = !imageMode && detectImageRequest(message);
    const effectiveImageMode = imageMode || autoDetectedImageMode;
    
    if (autoDetectedImageMode) {
      console.log('[Chat] Auto-detected image generation request');
    }

    // Handle image generation mode (explicit or auto-detected)
    // Note: The new image generation system uses /api/images/generate for full streaming support.
    // This fallback handles legacy imageMode requests and auto-detected requests.
    if (effectiveImageMode) {
      try {
        // For auto-detected requests, extract a cleaner prompt
        const imagePrompt = autoDetectedImageMode ? extractImagePrompt(message) : message;
        console.log(`[Chat] Generating image with prompt: "${imagePrompt.substring(0, 100)}..."`);
        
        const result = await generateImage(imagePrompt);
        
        // The new GeneratedImage type uses imageBase64 instead of url
        const imageDataUrl = `data:image/png;base64,${result.imageBase64}`;
        
        const responseData = {
          type: 'content',
          content: `![Generated Image](${imageDataUrl})\n\n${result.revisedPrompt ? `*${result.revisedPrompt}*` : ""}`,
          imageBase64: result.imageBase64,
          revisedPrompt: result.revisedPrompt,
        };

        return new Response(
          `data: ${JSON.stringify(responseData)}\n\ndata: [DONE]\n\n`,
          {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          }
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : '';
        console.error("Image generation error:", errorMessage);
        console.error("Stack:", errorStack);
        return new Response(
          `data: ${JSON.stringify({ type: 'content', content: `Sorry, I couldn't generate that image. Error: ${errorMessage}` })}\n\ndata: [DONE]\n\n`,
          {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          }
        );
      }
    }

    // Always create event bus for DB persistence and UI streaming
    const eventBus = createEventBus();
    
    // Collect events to stream to frontend (always collected for trace visibility)
    const collectedEvents: AgentEvent[] = [];
    
    // Set up listener to collect events for streaming to UI
    eventBus.on('*', (event: AgentEvent) => {
      collectedEvents.push(event);
    });

    // Helper to emit events (always emits for DB persistence)
    // Includes sessionId and turnId for historical trace retrieval
    const emitEvent = async (event: Omit<AgentEvent, 'runId' | 'sessionId' | 'turnId'>) => {
      await eventBus.emit({ ...event, runId, turnId, sessionId: sessionId || undefined } as AgentEvent);
    };

    // Handle auto mode classification
    let mode: Exclude<ChatMode, 'auto'> = requestedMode === 'auto' ? 'think' : requestedMode as Exclude<ChatMode, 'auto'>;
    let modeClassification: ModeClassification | null = null;

    if (requestedMode === 'auto') {
      await emitEvent({
        type: 'agent_started',
        agentId: 'mode_classifier',
        label: 'Analyzing query complexity',
      });

      try {
        modeClassification = await classifyQueryMode(message);
        mode = modeClassification.recommendedMode;
        
        await emitEvent({
          type: 'mode_classified',
          classification: modeClassification,
        });

        console.log(`[AutoMode] Classified as: ${mode} (confidence: ${modeClassification.confidence})`);
      } catch (error) {
        console.error('[AutoMode] Classification failed, defaulting to think:', error);
        mode = 'think';
      }
    }

    // Get user ID from header or use dev default
    const userId = request.headers.get('x-user-id') || DEV_USER_ID;

    // Fetch user settings
    const settingsResult = await db.select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1)
      .catch(() => []);

    const settings = settingsResult[0] || null;

    // Build full memory configuration from settings
    const memoryConfig: MemoryConfig = settings ? {
      memoryEnabled: settings.memoryEnabled ?? true,
      referenceSavedMemories: settings.referenceSavedMemories ?? true,
      referenceChatHistory: settings.referenceChatHistory ?? true,
      autoSaveMemories: settings.autoSaveMemories ?? false,
      memoryExtractionMode: (settings.memoryExtractionMode as MemoryExtractionMode) ?? 'balanced',
      maxMemoriesInContext: settings.maxMemoriesInContext ?? 10,
      includeSessionSummaries: settings.includeSessionSummaries ?? false,
    } : DEFAULT_MEMORY_CONFIG;

    // Initialize memory service
    const memoryService = new MemoryService();
    
    // Get 3-tier memory context (if enabled)
    let memoryContext: MemoryContext | null = null;
    if (memoryConfig.memoryEnabled && sessionId) {
      try {
        memoryContext = await memoryService.getContext({
          sessionId,
          userId,
          messages: [{ role: 'user', content: message }],
          config: memoryConfig,
        });
        
        // Emit memory retrieved event
        const tiersUsed: string[] = ['tier1']; // Working context always used
        if (memoryContext.sessionFacts.length > 0) tiersUsed.push('tier2');
        if (memoryContext.userProfileFacts.length > 0) tiersUsed.push('tier3');
        
        await emitEvent({
          type: 'memory_retrieved',
          tiersUsed,
          factsCount: memoryContext.sessionFacts.length + memoryContext.userProfileFacts.length,
          hasSummary: !!memoryContext.summary,
        });
        
        console.log(`[Memory] Retrieved context: ${memoryContext.sessionFacts.length} session facts, ` +
          `${memoryContext.userProfileFacts.length} user facts, summary: "${memoryContext.summary.substring(0, 50)}..."`);
      } catch (memError) {
        console.error('[Memory] Failed to get context:', memError);
      }
    }

    // Build personalization context (user profile and style)
    const personalizationContext = buildPersonalizationContext(
      settings ? {
        nickname: settings.nickname,
        occupation: settings.occupation,
        aboutMe: settings.aboutMe,
        conversationStyle: settings.conversationStyle,
        characteristics: settings.characteristics as Record<string, boolean> | null,
      } : null
    );

    // Format memory context for system prompt
    const memoryContextText = memoryContext ? formatMemoryContext(memoryContext) : '';

    // Log memory config
    console.log(`[Memory] Enabled: ${memoryConfig.memoryEnabled}, RefSaved: ${memoryConfig.referenceSavedMemories}, ` +
      `RefHistory: ${memoryConfig.referenceChatHistory}, AutoSave: ${memoryConfig.autoSaveMemories}, ` +
      `Mode: ${memoryConfig.memoryExtractionMode}, Max: ${memoryConfig.maxMemoriesInContext}`);

    // Map chat mode to retrieval mode
    const retrievalMode: RetrievalMode = mode as RetrievalMode;
    
    // Retrieve relevant data using the domain retriever
    let retrievalContext = "";
    let retrievalMetrics: { entitiesFound?: number; rowsReturned?: number; retrievalTimeMs?: number } = {};
    let retrievedChunks: Array<{ text?: string; content?: string; similarity?: number }> = [];
    
    const retrievalStartTime = Date.now();
    await emitEvent({
      type: 'retrieval_started',
      domains: modeClassification?.estimatedDomains || ['general'],
    });

    try {
      const retrieval = await domainRetriever.retrieve(message, retrievalMode);
      retrievalContext = retrieval.context;
      retrievalMetrics = retrieval.metrics;
      
      // Store chunks for evaluation
      retrievedChunks = (retrieval as { chunks?: Array<{ text?: string; content?: string; similarity?: number }> }).chunks || [];
      
      const retrievalTime = Date.now() - retrievalStartTime;
      await emitEvent({
        type: 'retrieval_complete',
        domains: modeClassification?.estimatedDomains || ['general'],
        resultsCount: retrieval.metrics.rowsReturned || 0,
        durationMs: retrievalTime,
      });
      
      console.log(`[Retrieval] Mode: ${mode}, Entities: ${retrieval.metrics.entitiesFound}, Rows: ${retrieval.metrics.rowsReturned}, Time: ${retrieval.metrics.retrievalTimeMs}ms`);
    } catch (error) {
      console.error("Retrieval error:", error);
      await emitEvent({
        type: 'log',
        level: 'error',
        message: 'Retrieval failed',
        agentId: 'retrieval',
      });
      // Continue without retrieval context if it fails
    }

    // Get mode configuration (with user overrides if available)
    const modeConfigOverrides = settings?.modeConfigOverrides as ModeSettingsOverrides | undefined;
    const memoryTierConfig = settings?.memoryTierConfig as MemoryTierConfig | undefined;
    const pipelineConfig = settings?.pipelineConfig as PipelineConfig | undefined;
    const modeConfig = getResolvedModeConfig(mode, modeConfigOverrides, memoryTierConfig, pipelineConfig);
    
    console.log(`[ModeConfig] Mode: ${mode}, MaxResults: ${modeConfig.maxResults}, GraphHops: ${modeConfig.graphHops}, WebResults: ${modeConfig.webResultsIfEnabled}`);

    // Emit mode selected event
    await emitEvent({
      type: 'mode_selected',
      mode,
      source: requestedMode === 'auto' ? 'auto' : 'user',
    });

    // Web search (if enabled and configured) - works for ALL modes when toggle is on
    let webSearchContext = "";
    
    if (webEnabled && isBraveSearchConfigured()) {
      const webResultCount = modeConfig.webResultsIfEnabled;
      const webSearchStartTime = Date.now();
      
      await emitEvent({
        type: 'web_search_started',
        query: message.substring(0, 200),
        maxResults: webResultCount,
      });
      
      try {
        const webResults = await braveSearch(message, webResultCount);
        webSearchContext = formatSearchResultsForContext(webResults);
        
        const webSearchDuration = Date.now() - webSearchStartTime;
        await emitEvent({
          type: 'web_search_complete',
          resultsCount: webResults.length,
          urls: webResults.slice(0, 5).map((r: { url?: string }) => r.url).filter(Boolean) as string[],
          durationMs: webSearchDuration,
        });
        
        console.log(`[WebSearch] Found ${webResults.length} results in ${webSearchDuration}ms (mode: ${mode})`);
      } catch (error) {
        console.error("Web search error:", error);
        await emitEvent({
          type: 'log',
          level: 'error',
          agentId: 'web_search',
          message: `Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        // Continue without web search context if it fails
      }
    }

    // Determine which model role to use based on mode config
    // The composerRole can be 'composer', 'composer_fast', or 'research'
    const modelRole = modeConfig.composerRole as ModelRole;

    // ============================================
    // RESEARCH MODE FLOW
    // Uses o3-deep-research with background mode
    // ============================================
    if (mode === 'research' && modeConfig.enableClarification) {
      const clarificationAgent = createClarificationAgent();
      
      // Check if this is an answer to previous clarification questions
      // by fetching the last assistant message from the session
      let isAnswerToClarification = false;
      let clarificationAnswers: Record<string, string> = {};
      
      if (sessionId) {
        try {
          const lastAssistantMessages = await db
            .select({ content: messagesTable.content })
            .from(messagesTable)
            .where(
              and(
                eq(messagesTable.sessionId, sessionId),
                eq(messagesTable.role, 'assistant')
              )
            )
            .orderBy(desc(messagesTable.createdAt))
            .limit(1);
          
          if (lastAssistantMessages.length > 0) {
            const previousAssistantMessage = lastAssistantMessages[0].content;
            isAnswerToClarification = clarificationAgent.detectClarificationAnswer(
              message,
              previousAssistantMessage
            );
            
            if (isAnswerToClarification) {
              // Extract the user's answers for use in research
              clarificationAnswers = clarificationAgent.extractAnswers(message);
              console.log('[Research] Detected clarification answer:', clarificationAnswers);
            }
          }
        } catch (error) {
          console.error('[Research] Error checking for clarification answer:', error);
          // Continue with normal flow if check fails
        }
      }
      
      // Only ask clarification questions if this is NOT an answer to previous clarification
      const clarificationResult = isAnswerToClarification 
        ? { shouldClarify: false, questions: [], originalQuery: message, skipReason: 'User answered clarification questions' }
        : await clarificationAgent.analyze(message);
      
      if (clarificationResult.shouldClarify) {
        // Emit clarification requested event
        await emitEvent({
          type: 'clarification_requested',
          questionCount: clarificationResult.questions.length,
          originalQuery: message,
        });
        
        // Format clarification questions for chat response
        const clarificationResponse = clarificationAgent.formatForChat(clarificationResult);
        
        // Return clarification questions as the response
        const encoder = new TextEncoder();
        const clarificationStream = new ReadableStream({
          async start(controller) {
            // Send mode info
            if (modeClassification) {
              const modeData = JSON.stringify({ 
                type: 'mode', 
                classification: modeClassification,
                runId,
                turnId,
              });
              controller.enqueue(encoder.encode(`data: ${modeData}\n\n`));
            }

            // Send collected events
            if (collectedEvents.length > 0) {
              for (const event of collectedEvents) {
                const eventData = JSON.stringify({ type: 'agent', event });
                controller.enqueue(encoder.encode(`data: ${eventData}\n\n`));
              }
            }

            // Send clarification questions as content
            const data = JSON.stringify({ type: 'content', content: clarificationResponse });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            
            await eventBus.shutdown();
          },
        });

        return new Response(clarificationStream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }
      
      // Query is specific enough (or user answered clarification) - proceed to deep research
      // Use o3-deep-research with background mode
      console.log('[Research] Starting deep research with o3-deep-research');
      
      // Build clarification context if user answered questions
      const clarificationContext = Object.keys(clarificationAnswers).length > 0
        ? `\n## User Preferences (from clarification)\n${Object.entries(clarificationAnswers)
            .map(([key, value]) => `- ${key}: ${value}`)
            .join('\n')}`
        : '';
      
      // Build research input with context
      const researchInput = `${message}
${clarificationContext}
${retrievalContext ? `\n## Available Data Context\n${retrievalContext}` : ''}
${memoryContextText ? `\n## User Context\n${memoryContextText}` : ''}`;

      try {
        // Submit deep research job
        const researchJob = await deepResearch(researchInput, {
          background: true,
          instructions: `You are conducting comprehensive research for a business intelligence platform. 
Analyze the query thoroughly, search the web for relevant information, and provide a detailed report.
Include citations and sources for all findings.`,
        });

        // Emit job created event
        await emitEvent({
          type: 'research_job_created',
          jobId: researchJob.id,
          estimatedDuration: '5-30 minutes',
        });

        // Create streaming response for polling loop
        const encoder = new TextEncoder();
        const researchStream = new ReadableStream({
          async start(controller) {
            try {
              // Send mode info
              if (modeClassification) {
                const modeData = JSON.stringify({ 
                  type: 'mode', 
                  classification: modeClassification,
                  runId,
                  turnId,
                });
                controller.enqueue(encoder.encode(`data: ${modeData}\n\n`));
              }

              // Send collected events
              if (collectedEvents.length > 0) {
                for (const event of collectedEvents) {
                  const eventData = JSON.stringify({ type: 'agent', event });
                  controller.enqueue(encoder.encode(`data: ${eventData}\n\n`));
                }
              }

              // Send initial progress message
              const startMsg = JSON.stringify({ 
                type: 'content', 
                content: '🔬 **Starting Deep Research**\n\nI\'m conducting comprehensive research on your query. This may take several minutes...\n\n' 
              });
              controller.enqueue(encoder.encode(`data: ${startMsg}\n\n`));

              // Poll for completion (up to 30 minutes)
              const maxPolls = 360; // 30 minutes with 5 second intervals
              const pollInterval = 5000; // 5 seconds
              let lastSourcesFound = 0;
              let lastSearchesCompleted = 0;
              const researchStartTime = Date.now();

              for (let i = 0; i < maxPolls; i++) {
                await new Promise(resolve => setTimeout(resolve, pollInterval));
                
                const status = await getDeepResearchStatus(researchJob.id);
                
                // Emit progress event
                const progressEvent: AgentEvent = {
                  runId,
                  sessionId: sessionId || undefined,
                  type: 'research_progress',
                  jobId: researchJob.id,
                  status: status.status,
                  message: `Researching... (${Math.round((Date.now() - researchStartTime) / 1000)}s)`,
                  searchesCompleted: status.searchesCompleted,
                  sourcesFound: status.sourcesFound,
                  progressPercent: Math.min(90, Math.round((i / maxPolls) * 100)),
                };
                await eventBus.emit(progressEvent);
                
                // Stream progress event to frontend
                const progressEventData = JSON.stringify({ type: 'agent', event: progressEvent });
                controller.enqueue(encoder.encode(`data: ${progressEventData}\n\n`));

                // Stream progress updates to user
                if (status.sourcesFound && status.sourcesFound > lastSourcesFound) {
                  const progressMsg = JSON.stringify({ 
                    type: 'content', 
                    content: `📚 Found ${status.sourcesFound} sources...\n` 
                  });
                  controller.enqueue(encoder.encode(`data: ${progressMsg}\n\n`));
                  lastSourcesFound = status.sourcesFound;
                }

                if (status.searchesCompleted && status.searchesCompleted > lastSearchesCompleted) {
                  lastSearchesCompleted = status.searchesCompleted;
                }

                // Check if complete
                if (status.status === 'completed') {
                  const durationMs = Date.now() - researchStartTime;
                  
                  // Emit completion event
                  const completeEvent: AgentEvent = {
                    runId,
                    sessionId: sessionId || undefined,
                    type: 'research_complete',
                    jobId: researchJob.id,
                    totalSources: status.sourcesFound || 0,
                    totalSearches: status.searchesCompleted || 0,
                    durationMs,
                    reportLength: status.output_text?.length || 0,
                  };
                  await eventBus.emit(completeEvent);
                  
                  // Stream complete event to frontend
                  const completeEventData = JSON.stringify({ type: 'agent', event: completeEvent });
                  controller.enqueue(encoder.encode(`data: ${completeEventData}\n\n`));

                  // Stream the final report
                  const divider = JSON.stringify({ type: 'content', content: '\n\n---\n\n# Research Report\n\n' });
                  controller.enqueue(encoder.encode(`data: ${divider}\n\n`));
                  
                  if (status.output_text) {
                    // Stream in chunks for better UX
                    const chunkSize = 500;
                    for (let j = 0; j < status.output_text.length; j += chunkSize) {
                      const chunk = status.output_text.slice(j, j + chunkSize);
                      const chunkData = JSON.stringify({ type: 'content', content: chunk });
                      controller.enqueue(encoder.encode(`data: ${chunkData}\n\n`));
                    }
                  }

                  break;
                }

                // Check for failure
                if (status.status === 'failed' || status.status === 'cancelled') {
                  const errorMsg = JSON.stringify({ 
                    type: 'content', 
                    content: `\n\n❌ Research ${status.status}. Please try again with a more specific query.` 
                  });
                  controller.enqueue(encoder.encode(`data: ${errorMsg}\n\n`));
                  break;
                }
              }

              // Send evaluation trigger
              const evalData = JSON.stringify({ type: 'evaluation', turnId, runId });
              controller.enqueue(encoder.encode(`data: ${evalData}\n\n`));

              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              
              await eventBus.shutdown();
            } catch (error) {
              console.error("Research streaming error:", error);
              const errorData = JSON.stringify({ 
                type: 'content',
                content: "Sorry, there was an error during research." 
              });
              controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              
              await eventBus.shutdown();
            }
          },
        });

        return new Response(researchStream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      } catch (error) {
        console.error("Deep research error:", error);
        // Fall through to standard chat if deep research fails
      }
    }

    // Build file context from attachments
    const fileContext = buildFileContext(attachments as FileAttachmentData[]);
    if (fileContext) {
      console.log(`[FileContext] Including ${(attachments as FileAttachmentData[]).filter((a: FileAttachmentData) => a.extractedContent).length} file(s) in context`);
    }

    // Build system prompt with retrieved context, memory, personalization, and file context
    const systemPrompt = `You are AgentKit, a helpful AI assistant that helps users understand and analyze their business data.

You have access to a multi-domain knowledge system with these capabilities:
- **Customer Domain**: Customer profiles, segments, lifetime value, health scores
- **Sales Domain**: Pipeline, opportunities, deals, forecasts
- **Product Domain**: Products, categories, inventory, pricing
- **Finance Domain**: Transactions, budgets, P&L, cash flow
- **Operations Domain**: Supply chain, suppliers, orders, logistics
- **HR Domain**: Employees, departments, org structure
- **Support Domain**: Tickets, SLAs, customer issues

You also have access to a Knowledge Graph that shows relationships between entities (customers, products, employees, etc.).

When answering questions:
1. Use the retrieved data context below to provide accurate, data-driven answers
2. Reference specific numbers, names, and facts from the data
3. If data is available, cite it in your response
4. If data is limited or unavailable, acknowledge this and provide general guidance
5. Provide actionable insights when possible

Current mode: ${mode}
${mode === "quick" ? "Provide brief, direct answers focused on the key facts." : ""}
${mode === "think" ? "Provide balanced analysis with key insights and supporting data." : ""}
${mode === "deep" ? "Provide comprehensive analysis with detailed explanations and relationships." : ""}
${mode === "research" ? "Conduct thorough research across all domains and provide detailed findings." : ""}

${personalizationContext ? `\n${personalizationContext}\n` : ""}

${memoryContextText ? `\n${memoryContextText}\n` : ""}

${retrievalContext ? `\n---\n## Retrieved Data Context\n${retrievalContext}\n---\n` : ""}

${webSearchContext ? `\n---\n${webSearchContext}\n---\n` : ""}

${fileContext ? `\n---\n${fileContext}\n---\n` : ""}

${webSearchContext ? "When using web search results, cite sources by including the URL." : ""}

When answering questions about uploaded files, reference the specific content from those files in your response.

If the retrieved data doesn't contain the answer, you can still provide helpful information based on your knowledge, but clarify that you're not pulling from the actual database.`;

    const chatMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ];

    // Track full response for memory extraction and evaluation
    let fullResponse = '';

    // Emit composition started event
    await emitEvent({
      type: 'agent_started',
      agentId: 'composer',
      label: `Generating ${mode} response`,
    });

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send mode classification first if auto mode was used
          if (modeClassification) {
            const modeData = JSON.stringify({ 
              type: 'mode', 
              classification: modeClassification,
              runId,
              turnId,
            });
            controller.enqueue(encoder.encode(`data: ${modeData}\n\n`));
          }

          // Send all collected agent events (from before streaming started)
          if (collectedEvents.length > 0) {
            for (const event of collectedEvents) {
              const eventData = JSON.stringify({ type: 'agent', event });
              controller.enqueue(encoder.encode(`data: ${eventData}\n\n`));
            }
          }

          // Stream content
          for await (const chunk of streamChat(modelRole as "composer" | "composer_fast", chatMessages)) {
            fullResponse += chunk;
            const data = JSON.stringify({ type: 'content', content: chunk });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }

          // Emit composition finished event and stream it
          const finishedEvent: AgentEvent = {
            runId,
            sessionId: sessionId || undefined,
            type: 'agent_finished',
            agentId: 'composer',
            summary: `Generated ${fullResponse.length} character response`,
          };
          await eventBus.emit(finishedEvent);
          
          // Stream the finished event to frontend
          const finishedEventData = JSON.stringify({ type: 'agent', event: finishedEvent });
          controller.enqueue(encoder.encode(`data: ${finishedEventData}\n\n`));

          // Run memory update and evaluation in parallel, waiting for results
          // so we can emit events BEFORE closing the stream
          const postProcessingPromises: Promise<void>[] = [];

          // Memory update promise
          if (memoryConfig.memoryEnabled && memoryConfig.autoSaveMemories && sessionId && fullResponse) {
            const memoryPromise = memoryService.updateAfterTurn({
              sessionId,
              userId,
              messages: [{ role: 'user', content: message }],
              answer: fullResponse,
              config: memoryConfig,
            }).then(async (result) => {
              // Emit memory saved event and stream it
              if (result) {
                const memorySavedEvent: AgentEvent = {
                  runId,
                  sessionId: sessionId || undefined,
                  type: 'memory_saved',
                  sessionFactsCount: result.sessionFactsSaved ?? 0,
                  userFactsCount: result.userFactsSaved ?? 0,
                  summaryUpdated: result.summaryUpdated ?? false,
                };
                await eventBus.emit(memorySavedEvent);
                
                // Stream the memory event to frontend
                const memorySavedEventData = JSON.stringify({ type: 'agent', event: memorySavedEvent });
                controller.enqueue(encoder.encode(`data: ${memorySavedEventData}\n\n`));
              }
            }).catch(err => {
              console.error('[Memory] Failed to update after turn:', err);
            });
            postProcessingPromises.push(memoryPromise);
          }

          // Evaluation promise - we always generate it for ALL modes
          if (sessionId && fullResponse) {
            const evalPromise = evaluateAndSaveResponse({
              turnId,
              sessionId,
              query: message,
              answer: fullResponse,
              retrievedChunks,
              mode,
            }).then(async (evalResult) => {
              // Emit judge evaluation event and stream it
              if (evalResult) {
                const judgeEvent: AgentEvent = {
                  runId,
                  sessionId: sessionId || undefined,
                  type: 'judge_evaluation',
                  qualityScore: evalResult.qualityScore ?? 0,
                  relevance: evalResult.relevanceScore ?? 0,
                  groundedness: evalResult.groundednessScore ?? 0,
                  coherence: evalResult.coherenceScore ?? 0,
                  completeness: evalResult.completenessScore ?? 0,
                };
                await eventBus.emit(judgeEvent);
                
                // Stream the evaluation event to frontend
                const judgeEventData = JSON.stringify({ type: 'agent', event: judgeEvent });
                controller.enqueue(encoder.encode(`data: ${judgeEventData}\n\n`));
              }
            }).catch(err => {
              console.error('[Evaluation] Failed:', err);
            });
            postProcessingPromises.push(evalPromise);
          }

          // Wait for post-processing with a timeout (10 seconds max)
          // This ensures events are streamed before closing, but we don't hang forever
          if (postProcessingPromises.length > 0) {
            const timeoutPromise = new Promise<void>(resolve => setTimeout(resolve, 10000));
            await Promise.race([
              Promise.allSettled(postProcessingPromises),
              timeoutPromise,
            ]);
          }

          // Send evaluation trigger with turnId (for UI to know evaluation is available)
          const evalData = JSON.stringify({ 
            type: 'evaluation', 
            turnId,
            runId,
          });
          controller.enqueue(encoder.encode(`data: ${evalData}\n\n`));

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();

          // Cleanup event bus (always created, so always shut down)
          await eventBus.shutdown();
        } catch (error) {
          console.error("Streaming error:", error);
          const errorData = JSON.stringify({ 
            type: 'content',
            content: "Sorry, there was an error processing your request." 
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();

          // Cleanup event bus on error
          await eventBus.shutdown();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
