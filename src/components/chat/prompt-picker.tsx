"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Lightbulb,
  Search,
  Loader2,
} from "lucide-react";

export interface PromptLibraryItem {
  id: string;
  userId: string | null;
  title: string;
  content: string;
  category: string | null;
  isSystem: boolean | null;
  isEdited: boolean | null;
  systemPromptId: string | null;
  displayOrder: number | null;
  originalContent?: string;
  createdAt: string;
  updatedAt: string;
}

interface PromptPickerProps {
  onSelectPrompt: (content: string) => void;
  disabled?: boolean;
}

export function PromptPicker({ onSelectPrompt, disabled = false }: PromptPickerProps) {
  const [open, setOpen] = useState(false);
  const [prompts, setPrompts] = useState<PromptLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch prompts when popover opens
  useEffect(() => {
    if (open && prompts.length === 0) {
      fetchPrompts();
    }
  }, [open]);

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/prompts");
      if (response.ok) {
        const data = await response.json();
        setPrompts(data);
      }
    } catch (error) {
      console.error("Failed to fetch prompts:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter prompts by search query
  const filteredPrompts = useMemo(() => {
    if (!searchQuery.trim()) {
      return prompts;
    }
    
    const query = searchQuery.toLowerCase();
    return prompts.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.content.toLowerCase().includes(query)
    );
  }, [prompts, searchQuery]);

  // Handle prompt selection - insert directly
  const handleSelectPrompt = (prompt: PromptLibraryItem) => {
    onSelectPrompt(prompt.content);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={disabled}
          title="Prompt Library"
        >
          <Lightbulb className="h-4 w-4" />
          <span className="hidden sm:inline">Prompts</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="start">
        <div className="p-3 border-b">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-5 w-5 text-primary" />
            <h4 className="font-semibold">Prompt Library</h4>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPrompts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No prompts found</p>
              <p className="text-xs mt-1">Add prompts in Settings</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredPrompts.map((prompt) => (
                <button
                  key={prompt.id}
                  onClick={() => handleSelectPrompt(prompt)}
                  className="w-full text-left p-2.5 rounded-md hover:bg-muted transition-colors"
                >
                  <div className="font-medium text-sm">{prompt.title}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {prompt.content}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-2.5 border-t text-xs text-muted-foreground text-center">
          Click a prompt to insert it into the input
        </div>
      </PopoverContent>
    </Popover>
  );
}
