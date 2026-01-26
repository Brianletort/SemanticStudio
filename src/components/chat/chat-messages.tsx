"use client";

import React, { useEffect, useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Bot, User, Loader2, Download, ImageIcon, Maximize2, FileText, FileSpreadsheet, Presentation, FileJson, File } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { FileAttachment } from "./chat-input";
import { ImageProgress } from "./image-progress";
import { CodeBlock } from "./code-block";
import { EvaluationDisplay } from "./evaluation-display";

interface PartialImage {
  index: number;
  imageBase64: string;
}

export interface ImageGenerationData {
  isGenerating: boolean;
  progress: number;
  partialImages: PartialImage[];
  startTime?: number;
  finalImage?: string;
  revisedPrompt?: string;
  quality?: string;
  size?: string;
  background?: string;
  durationMs?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
  attachments?: FileAttachment[];
  isStreaming?: boolean;
  imageGeneration?: ImageGenerationData;
  turnId?: string;
  effectiveMode?: 'quick' | 'think' | 'deep' | 'research';
}

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading?: boolean;
}

// Helper to get file type icon
function getFileIcon(type: string, name: string) {
  const ext = name.toLowerCase().split('.').pop();
  
  // Check by MIME type first
  if (type.startsWith('image/')) {
    return <ImageIcon className="h-3 w-3" />;
  }
  if (type === 'application/pdf') {
    return <FileText className="h-3 w-3 text-red-500" />;
  }
  if (type.includes('spreadsheet') || type.includes('excel') || ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
    return <FileSpreadsheet className="h-3 w-3 text-green-600" />;
  }
  if (type.includes('presentation') || type.includes('powerpoint') || ext === 'pptx' || ext === 'ppt') {
    return <Presentation className="h-3 w-3 text-orange-500" />;
  }
  if (type.includes('word') || ext === 'docx' || ext === 'doc') {
    return <FileText className="h-3 w-3 text-blue-500" />;
  }
  if (type === 'application/json' || ext === 'json') {
    return <FileJson className="h-3 w-3 text-yellow-600" />;
  }
  if (type === 'text/markdown' || ext === 'md') {
    return <FileText className="h-3 w-3 text-purple-500" />;
  }
  
  return <File className="h-3 w-3" />;
}

export function ChatMessages({ messages, isLoading = false }: ChatMessagesProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div 
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden p-4"
    >
      <div className="max-w-3xl mx-auto space-y-6 w-full">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center">
            <Bot className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Welcome to AgentKit</h2>
            <p className="text-muted-foreground max-w-md">
              Ask me anything about your business data. I can help with customer insights,
              sales analytics, financial reports, and much more.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-4 ${message.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className={message.role === "assistant" ? "bg-primary text-primary-foreground" : "bg-muted"}>
                {message.role === "assistant" ? (
                  <Bot className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </AvatarFallback>
            </Avatar>

            <div
              className={`flex-1 min-w-0 space-y-2 ${
                message.role === "user" ? "text-right" : ""
              }`}
            >
              {/* Attachments for user messages */}
              {message.attachments && message.attachments.length > 0 && (
                <div className={`flex gap-2 flex-wrap ${message.role === "user" ? "justify-end" : ""}`}>
                  {message.attachments.map((file) => (
                    <div
                      key={file.id}
                      className={`flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 ${
                        file.status === 'error' 
                          ? 'bg-destructive/10 text-destructive' 
                          : 'bg-muted/80'
                      }`}
                      title={file.extractedContent 
                        ? `${file.name} - ${file.extractedContent.length.toLocaleString()} characters extracted`
                        : file.name
                      }
                    >
                      {getFileIcon(file.type, file.name)}
                      <span className="max-w-[120px] truncate font-medium">{file.name}</span>
                      {file.status === 'ready' && file.extractedContent && (
                        <span className="text-green-600 text-[10px]">✓</span>
                      )}
                      {file.status === 'error' && (
                        <span className="text-[10px]">✗</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Message content */}
              <div
                className={`rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "inline-block max-w-[85%] bg-primary text-primary-foreground ml-auto"
                    : "block w-full bg-muted"
                }`}
              >
                {message.role === "assistant" ? (
                  <div className="prose dark:prose-invert max-w-none prose-p:my-3 prose-headings:mt-6 prose-headings:mb-3 prose-ul:my-4 prose-ol:my-4 prose-li:my-2 prose-table:my-4 prose-blockquote:my-4 prose-hr:my-6">
                    {/* Image generation progress */}
                    {message.imageGeneration?.isGenerating && (
                      <ImageProgress
                        isGenerating={message.imageGeneration.isGenerating}
                        progress={message.imageGeneration.progress}
                        partialImages={message.imageGeneration.partialImages}
                        startTime={message.imageGeneration.startTime}
                        className="mb-4"
                      />
                    )}
                    
                    {/* Final generated image */}
                    {message.imageGeneration?.finalImage && (
                      <GeneratedImageDisplay
                        imageBase64={message.imageGeneration.finalImage}
                        revisedPrompt={message.imageGeneration.revisedPrompt}
                        quality={message.imageGeneration.quality}
                        size={message.imageGeneration.size}
                        background={message.imageGeneration.background}
                        durationMs={message.imageGeneration.durationMs}
                      />
                    )}
                    
                    {/* Regular text content */}
                    {message.content && !message.imageGeneration?.finalImage && (
                      <Markdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          // Links
                          a: ({ ...props }) => (
                            <a {...props} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" />
                          ),
                          // Code blocks with syntax highlighting
                          code: ({ className, children, ...props }) => {
                            const isInline = !className;
                            
                            // Inline code
                            if (isInline) {
                              return (
                                <code className="bg-background/50 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                                  {children}
                                </code>
                              );
                            }
                            
                            // Code block with syntax highlighting
                            const codeString = String(children).replace(/\n$/, "");
                            return <CodeBlock language={className}>{codeString}</CodeBlock>;
                          },
                          pre: ({ children }) => <>{children}</>,
                          // Tables
                          table: ({ ...props }) => (
                            <div className="overflow-x-auto my-4">
                              <table className="min-w-full border-collapse border border-border" {...props} />
                            </div>
                          ),
                          thead: ({ ...props }) => (
                            <thead className="bg-muted/50" {...props} />
                          ),
                          th: ({ ...props }) => (
                            <th className="border border-border px-4 py-2 text-left font-semibold" {...props} />
                          ),
                          td: ({ ...props }) => (
                            <td className="border border-border px-4 py-2" {...props} />
                          ),
                          // Headings
                          h1: ({ ...props }) => <h1 className="text-2xl font-bold mt-6 mb-3" {...props} />,
                          h2: ({ ...props }) => <h2 className="text-xl font-bold mt-5 mb-2" {...props} />,
                          h3: ({ ...props }) => <h3 className="text-lg font-semibold mt-4 mb-2" {...props} />,
                          h4: ({ ...props }) => <h4 className="text-base font-semibold mt-4 mb-2" {...props} />,
                          h5: ({ ...props }) => <h5 className="text-sm font-semibold mt-3 mb-1" {...props} />,
                          h6: ({ ...props }) => <h6 className="text-sm font-medium mt-3 mb-1" {...props} />,
                          // Blockquote
                          blockquote: ({ ...props }) => (
                            <blockquote className="border-l-4 border-primary/50 pl-4 italic my-4 text-muted-foreground" {...props} />
                          ),
                          // Horizontal rule
                          hr: () => <hr className="border-t border-border my-6" />,
                          // Lists
                          ul: ({ ...props }) => <ul className="list-disc pl-6 my-4 space-y-2" {...props} />,
                          ol: ({ ...props }) => <ol className="list-decimal pl-6 my-4 space-y-2" {...props} />,
                          li: ({ ...props }) => <li className="my-1" {...props} />,
                          // Paragraphs
                          p: ({ ...props }) => <p className="my-3 leading-relaxed" {...props} />,
                          // Strong/emphasis
                          strong: ({ ...props }) => <strong className="font-semibold" {...props} />,
                        }}
                      >
                        {message.content}
                      </Markdown>
                    )}
                    {message.isStreaming && (
                      <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
                    )}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}
              </div>

              {/* Evaluation display for assistant messages */}
              {message.role === "assistant" && message.turnId && !message.isStreaming && (
                <EvaluationDisplay
                  turnId={message.turnId}
                  messageContent={message.content}
                  mode={message.effectiveMode}
                />
              )}

              {/* Timestamp */}
              {message.timestamp && (
                <p className="text-xs text-muted-foreground">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-4">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="bg-muted rounded-2xl px-4 py-3 inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Thinking...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Component for displaying generated images
interface GeneratedImageDisplayProps {
  imageBase64: string;
  revisedPrompt?: string;
  quality?: string;
  size?: string;
  background?: string;
  durationMs?: number;
}

function GeneratedImageDisplay({
  imageBase64,
  revisedPrompt,
  quality,
  size,
  background,
  durationMs,
}: GeneratedImageDisplayProps) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${imageBase64}`;
    link.download = `generated-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenFullscreen = () => {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`
        <html>
          <head><title>Generated Image</title></head>
          <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;">
            <img src="data:image/png;base64,${imageBase64}" style="max-width:100%;max-height:100vh;object-fit:contain;" />
          </body>
        </html>
      `);
    }
  };

  return (
    <div className="space-y-3">
      {/* Image container */}
      <div className="relative group rounded-lg overflow-hidden border bg-background/50 max-w-md">
        <img
          src={`data:image/png;base64,${imageBase64}`}
          alt="Generated image"
          className="w-full h-auto"
          style={{
            // Show checkerboard pattern for transparent images
            backgroundImage: background === 'transparent' 
              ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)'
              : undefined,
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          }}
        />
        
        {/* Action buttons overlay */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-background/80 backdrop-blur-sm"
            onClick={handleOpenFullscreen}
            title="Open fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-background/80 backdrop-blur-sm"
            onClick={handleDownload}
            title="Download image"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <div className="space-y-1">
        {revisedPrompt && (
          <p className="text-sm text-muted-foreground italic">
            {revisedPrompt}
          </p>
        )}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {quality && (
            <span className="bg-background/50 px-2 py-0.5 rounded">
              Quality: {quality}
            </span>
          )}
          {size && (
            <span className="bg-background/50 px-2 py-0.5 rounded">
              {size}
            </span>
          )}
          {background === 'transparent' && (
            <span className="bg-background/50 px-2 py-0.5 rounded">
              Transparent
            </span>
          )}
          {durationMs && (
            <span className="bg-background/50 px-2 py-0.5 rounded">
              {(durationMs / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
