"use client";

import React, { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PartialImage {
  index: number;
  imageBase64: string;
}

interface ImageProgressProps {
  isGenerating: boolean;
  progress: number;
  partialImages: PartialImage[];
  startTime?: number;
  className?: string;
}

export function ImageProgress({
  isGenerating,
  progress,
  partialImages,
  startTime,
  className,
}: ImageProgressProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  // Update elapsed time every second while generating
  useEffect(() => {
    if (!isGenerating || !startTime) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isGenerating, startTime]);

  // Format elapsed time as mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get status message based on progress
  const getStatusMessage = (): string => {
    if (progress < 20) return "Starting generation...";
    if (progress < 50) return "Creating image...";
    if (progress < 80) return "Adding details...";
    if (progress < 100) return "Finalizing...";
    return "Complete!";
  };

  if (!isGenerating && partialImages.length === 0) {
    return null;
  }

  // Get the latest partial image to show as preview
  const latestPartial = partialImages.length > 0 
    ? partialImages[partialImages.length - 1] 
    : null;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Progress header */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <ImageIcon className="h-4 w-4 text-primary" />
          )}
          <span className="text-muted-foreground">{getStatusMessage()}</span>
        </div>
        {isGenerating && startTime && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatTime(elapsedTime)}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <Progress value={progress} className="h-2" />

      {/* Partial image preview */}
      {isGenerating && (
        <div className="relative aspect-square max-w-sm mx-auto rounded-lg overflow-hidden border bg-muted/30">
          {latestPartial ? (
            <>
              <img
                src={`data:image/png;base64,${latestPartial.imageBase64}`}
                alt={`Preview ${latestPartial.index + 1}`}
                className="w-full h-full object-cover opacity-80"
              />
              {/* Overlay showing it's a preview */}
              <div className="absolute inset-0 flex items-center justify-center bg-background/30 backdrop-blur-[1px]">
                <div className="bg-background/80 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm">
                  Preview {latestPartial.index + 1}/3
                </div>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Skeleton className="h-16 w-16 rounded-lg" />
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Generating preview...
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Partial image thumbnails */}
      {partialImages.length > 1 && (
        <div className="flex gap-2 justify-center">
          {partialImages.map((partial) => (
            <div
              key={partial.index}
              className={cn(
                "relative h-12 w-12 rounded border overflow-hidden",
                partial.index === latestPartial?.index && "ring-2 ring-primary"
              )}
            >
              <img
                src={`data:image/png;base64,${partial.imageBase64}`}
                alt={`Partial ${partial.index + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {/* Hint for long renders */}
      {isGenerating && elapsedTime > 30 && (
        <p className="text-xs text-center text-muted-foreground">
          Complex images may take up to 2-3 minutes to generate
        </p>
      )}
    </div>
  );
}
