"use client";

import React, { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { 
  Upload, 
  X, 
  ImageIcon, 
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  fileId?: string; // OpenAI file ID after upload
  status: 'pending' | 'uploading' | 'ready' | 'error';
  error?: string;
}

interface ImageUploadProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  onUpload: (file: File) => Promise<string>; // Returns file ID
  maxImages?: number;
  disabled?: boolean;
  className?: string;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export function ImageUpload({
  images,
  onImagesChange,
  onUpload,
  maxImages = 5,
  disabled = false,
  className,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Invalid file type. Use PNG, JPEG, WebP, or GIF.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File too large. Maximum size is 50MB.';
    }
    return null;
  };

  const handleFiles = useCallback(async (files: FileList) => {
    const newImages: UploadedImage[] = [];
    const remainingSlots = maxImages - images.length;

    for (let i = 0; i < Math.min(files.length, remainingSlots); i++) {
      const file = files[i];
      const error = validateFile(file);
      
      const image: UploadedImage = {
        id: `${Date.now()}-${i}`,
        file,
        preview: URL.createObjectURL(file),
        status: error ? 'error' : 'pending',
        error: error || undefined,
      };
      
      newImages.push(image);
    }

    const allImages = [...images, ...newImages];
    onImagesChange(allImages);

    // Upload each valid image
    let currentImages = allImages;
    for (const image of newImages) {
      if (image.status === 'error') continue;

      // Update status to uploading
      currentImages = currentImages.map(img => 
        img.id === image.id 
          ? { ...img, status: 'uploading' as const } 
          : img
      );
      onImagesChange(currentImages);

      try {
        const fileId = await onUpload(image.file);
        currentImages = currentImages.map(img =>
          img.id === image.id
            ? { ...img, status: 'ready' as const, fileId }
            : img
        );
        onImagesChange(currentImages);
      } catch (err) {
        currentImages = currentImages.map(img =>
          img.id === image.id
            ? { 
                ...img, 
                status: 'error' as const, 
                error: err instanceof Error ? err.message : 'Upload failed' 
              }
            : img
        );
        onImagesChange(currentImages);
      }
    }
  }, [images, maxImages, onImagesChange, onUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (disabled) return;
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  }, [disabled, handleFiles]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  const handleRemoveImage = (imageId: string) => {
    const image = images.find(img => img.id === imageId);
    if (image) {
      URL.revokeObjectURL(image.preview);
    }
    onImagesChange(images.filter(img => img.id !== imageId));
  };

  const canAddMore = images.length < maxImages;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((image) => (
            <div
              key={image.id}
              className="relative group h-20 w-20 rounded-lg overflow-hidden border bg-muted"
            >
              <img
                src={image.preview}
                alt="Upload preview"
                className={cn(
                  "w-full h-full object-cover",
                  image.status === 'uploading' && "opacity-50",
                  image.status === 'error' && "opacity-30"
                )}
              />
              
              {/* Status overlay */}
              {image.status === 'uploading' && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}
              
              {image.status === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center bg-destructive/10">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
              )}

              {/* Remove button */}
              <button
                onClick={() => handleRemoveImage(image.id)}
                className="absolute top-1 right-1 h-5 w-5 rounded-full bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>

              {/* Ready indicator */}
              {image.status === 'ready' && (
                <div className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                  <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
      {canAddMore && (
        <div
          className={cn(
            "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 transition-colors cursor-pointer",
            isDragging && "border-primary bg-primary/5",
            disabled && "opacity-50 cursor-not-allowed",
            !isDragging && !disabled && "hover:border-muted-foreground/50"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept={ALLOWED_TYPES.join(',')}
            onChange={handleFileInputChange}
            disabled={disabled}
          />

          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted">
            {isDragging ? (
              <Upload className="h-5 w-5 text-primary" />
            ) : (
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            )}
          </div>

          <div className="text-center">
            <p className="text-sm font-medium">
              {isDragging ? "Drop images here" : "Upload images for editing"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PNG, JPEG, WebP, GIF up to 50MB
            </p>
          </div>

          {images.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {images.length}/{maxImages} images
            </p>
          )}
        </div>
      )}

      {/* Error messages */}
      {images.some(img => img.status === 'error') && (
        <div className="space-y-1">
          {images
            .filter(img => img.status === 'error')
            .map(img => (
              <p key={img.id} className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {img.file.name}: {img.error}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
