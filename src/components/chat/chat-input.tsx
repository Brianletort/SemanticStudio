"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Send, Mic, Plus, Paperclip, Image, X, Settings2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ImageOptions, ImageQuality, ImageSize } from "./image-options";
import { ImageUpload, UploadedImage } from "./image-upload";

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  extractedContent?: string;  // Extracted text content from documents
  imageData?: string;         // Base64 data URL for images (vision models)
  error?: string;             // Error message if processing failed
}

export interface ImageGenerationSettings {
  quality: ImageQuality;
  size: ImageSize;
  transparentBackground: boolean;
  inputImages: UploadedImage[];
}

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (message: string, imageSettings?: ImageGenerationSettings) => void;
  disabled?: boolean;
  placeholder?: string;
  attachments?: FileAttachment[];
  onFileSelect?: (files: FileList) => void;
  onFileRemove?: (fileId: string) => void;
  onImageModeToggle?: () => void;
  imageMode?: boolean;
  onImageUpload?: (file: File) => Promise<string>;
  sessionId?: string;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Type a message...",
  attachments = [],
  onFileSelect,
  onFileRemove,
  onImageModeToggle,
  imageMode = false,
  onImageUpload,
  sessionId,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showImageOptions, setShowImageOptions] = useState(false);
  
  // Image generation settings
  const [imageQuality, setImageQuality] = useState<ImageQuality>('medium');
  const [imageSize, setImageSize] = useState<ImageSize>('1024x1024');
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

  // Handle image upload
  const handleImageUpload = useCallback(async (file: File): Promise<string> => {
    if (!onImageUpload) {
      throw new Error('Image upload not configured');
    }
    return onImageUpload(file);
  }, [onImageUpload]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const maxHeight = 200;
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
      textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, [value]);

  const handleSubmit = () => {
    if (!value.trim() || disabled) return;
    const message = value;
    onChange("");
    
    // Include image settings if in image mode
    if (imageMode) {
      const imageSettings: ImageGenerationSettings = {
        quality: imageQuality,
        size: imageSize,
        transparentBackground,
        inputImages: uploadedImages.filter(img => img.status === 'ready'),
      };
      onSubmit(message, imageSettings);
      // Clear uploaded images after submit
      setUploadedImages([]);
    } else {
      onSubmit(message);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Voice input is not supported in your browser.');
      return;
    }

    const recognition = new (window as unknown as { webkitSpeechRecognition: new () => SpeechRecognition }).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      onChange(value + transcript);
      textareaRef.current?.focus();
    };
    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (!onFileSelect) return;
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      onFileSelect(files);
    }
  }, [onFileSelect]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && onFileSelect) {
      onFileSelect(e.target.files);
    }
  };

  return (
    <div
      className="space-y-2"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* File attachments preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-2">
          {attachments.map((file) => (
            <div
              key={file.id}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                file.status === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-muted'
              }`}
            >
              <Paperclip className="h-3 w-3" />
              <span className="max-w-[150px] truncate">{file.name}</span>
              {file.status === 'uploading' && (
                <span className="text-xs text-muted-foreground">Uploading...</span>
              )}
              {file.status === 'processing' && (
                <span className="text-xs text-muted-foreground">Processing...</span>
              )}
              {file.status === 'error' && (
                <span className="text-xs" title={file.error}>Failed</span>
              )}
              {file.status === 'ready' && file.extractedContent && (
                <span className="text-xs text-green-600">Ready</span>
              )}
              {onFileRemove && (
                <button
                  onClick={() => onFileRemove(file.id)}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Image mode indicator and options */}
      {imageMode && (
        <div className="space-y-2 mx-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg">
            <Image className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Image generation mode</span>
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-primary hover:text-primary"
                onClick={() => setShowImageOptions(!showImageOptions)}
              >
                <Settings2 className="h-3.5 w-3.5 mr-1" />
                <span className="text-xs">Options</span>
              </Button>
              <button
                onClick={onImageModeToggle}
                className="p-1 hover:text-destructive rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          {/* Image options panel */}
          {showImageOptions && (
            <div className="space-y-3">
              <ImageOptions
                quality={imageQuality}
                size={imageSize}
                transparentBackground={transparentBackground}
                onQualityChange={setImageQuality}
                onSizeChange={setImageSize}
                onTransparentBackgroundChange={setTransparentBackground}
                disabled={disabled}
              />
              
              {/* Image upload for editing */}
              {onImageUpload && (
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <p className="text-xs text-muted-foreground font-medium mb-2">
                    Reference images (optional)
                  </p>
                  <ImageUpload
                    images={uploadedImages}
                    onImagesChange={setUploadedImages}
                    onUpload={handleImageUpload}
                    maxImages={5}
                    disabled={disabled}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main input area */}
      <div
        className={`flex items-end gap-2 rounded-2xl border bg-muted/30 px-4 py-3 transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : ''
        }`}
      >
        {/* Plus menu for attachments and media */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full hover:bg-muted"
              disabled={disabled}
              title="Add files or create media"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-4 w-4 mr-2" />
              <div className="flex flex-col">
                <span>Upload files</span>
                <span className="text-xs text-muted-foreground">PDF, DOCX, PPTX, XLSX, images, CSV</span>
              </div>
            </DropdownMenuItem>
            {onImageModeToggle && (
              <DropdownMenuItem onClick={onImageModeToggle}>
                <Image className="h-4 w-4 mr-2" />
                <div className="flex flex-col">
                  <span>Create image</span>
                  <span className="text-xs text-muted-foreground">gpt-image-1.5</span>
                </div>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={handleFileInputChange}
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.gif,.webp"
        />

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={imageMode ? "Describe the image you want to create..." : placeholder}
          className="flex-1 border-0 bg-transparent focus:outline-none focus:ring-0 text-base resize-none min-h-[24px] max-h-[200px] py-1 leading-6"
          disabled={disabled}
          rows={1}
          style={{ height: '24px' }}
        />

        {/* Voice button */}
        <Button
          onClick={handleVoiceInput}
          variant="ghost"
          size="icon"
          className={`h-8 w-8 shrink-0 ${isListening ? 'bg-red-500 text-white hover:bg-red-600' : ''}`}
          title={isListening ? "Listening..." : "Voice input"}
          disabled={disabled}
        >
          <Mic className={`h-4 w-4 ${isListening ? 'animate-pulse' : ''}`} />
        </Button>

        {/* Send button */}
        <Button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          size="sm"
          className="px-4"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-2xl border-2 border-dashed border-primary pointer-events-none z-10">
          <p className="text-primary font-medium">Drop files here</p>
        </div>
      )}
    </div>
  );
}

// Type declarations for Web Speech API
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: () => void;
  onend: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: Event) => void;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
