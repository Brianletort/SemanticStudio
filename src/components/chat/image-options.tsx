"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Square, 
  RectangleVertical, 
  RectangleHorizontal,
  Zap,
  Sparkles,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ImageQuality = 'low' | 'medium' | 'high';
export type ImageSize = '1024x1024' | '1024x1536' | '1536x1024';

interface ImageOptionsProps {
  quality: ImageQuality;
  size: ImageSize;
  transparentBackground: boolean;
  onQualityChange: (quality: ImageQuality) => void;
  onSizeChange: (size: ImageSize) => void;
  onTransparentBackgroundChange: (transparent: boolean) => void;
  disabled?: boolean;
}

const qualityOptions: { value: ImageQuality; label: string; icon: React.ReactNode; description: string }[] = [
  { 
    value: 'low', 
    label: 'Low', 
    icon: <Zap className="h-3.5 w-3.5" />, 
    description: 'Faster generation, lower cost' 
  },
  { 
    value: 'medium', 
    label: 'Med', 
    icon: <Sparkles className="h-3.5 w-3.5" />, 
    description: 'Balanced quality and speed' 
  },
  { 
    value: 'high', 
    label: 'High', 
    icon: <Crown className="h-3.5 w-3.5" />, 
    description: 'Best quality, may take longer' 
  },
];

const sizeOptions: { value: ImageSize; label: string; icon: React.ReactNode; description: string }[] = [
  { 
    value: '1024x1024', 
    label: 'Square', 
    icon: <Square className="h-3.5 w-3.5" />, 
    description: '1024x1024 - Profile pictures, icons' 
  },
  { 
    value: '1024x1536', 
    label: 'Portrait', 
    icon: <RectangleVertical className="h-3.5 w-3.5" />, 
    description: '1024x1536 - Mobile, stories' 
  },
  { 
    value: '1536x1024', 
    label: 'Landscape', 
    icon: <RectangleHorizontal className="h-3.5 w-3.5" />, 
    description: '1536x1024 - Desktop, banners' 
  },
];

export function ImageOptions({
  quality,
  size,
  transparentBackground,
  onQualityChange,
  onSizeChange,
  onTransparentBackgroundChange,
  disabled = false,
}: ImageOptionsProps) {
  return (
    <TooltipProvider>
      <div className="flex flex-col gap-3 p-3 bg-muted/30 rounded-lg border">
        {/* Quality selection */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-medium">Quality</Label>
          <div className="flex gap-1">
            {qualityOptions.map((option) => (
              <Tooltip key={option.value}>
                <TooltipTrigger asChild>
                  <Button
                    variant={quality === option.value ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "flex-1 gap-1.5 h-8",
                      quality === option.value && "shadow-sm"
                    )}
                    onClick={() => onQualityChange(option.value)}
                    disabled={disabled}
                  >
                    {option.icon}
                    <span className="text-xs">{option.label}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{option.description}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Size selection */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-medium">Size</Label>
          <div className="flex gap-1">
            {sizeOptions.map((option) => (
              <Tooltip key={option.value}>
                <TooltipTrigger asChild>
                  <Button
                    variant={size === option.value ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "flex-1 gap-1.5 h-8",
                      size === option.value && "shadow-sm"
                    )}
                    onClick={() => onSizeChange(option.value)}
                    disabled={disabled}
                  >
                    {option.icon}
                    <span className="text-xs">{option.label}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{option.description}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Transparent background toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label 
              htmlFor="transparent-bg" 
              className="text-xs font-medium cursor-pointer"
            >
              Transparent background
            </Label>
            <p className="text-xs text-muted-foreground">
              For logos, icons, overlays
            </p>
          </div>
          <Switch
            id="transparent-bg"
            checked={transparentBackground}
            onCheckedChange={onTransparentBackgroundChange}
            disabled={disabled}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
