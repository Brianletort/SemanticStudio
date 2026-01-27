"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Pin,
  PinOff,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderInput,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isPinned?: boolean;
  pinnedAt?: string | null;
  folderId?: string | null;
}

export interface SessionFolder {
  id: string;
  name: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface SearchResult {
  id: string;
  title: string;
  snippet?: string;
  matchType: "title" | "message";
  updatedAt: string | null;
}

interface SessionPaneProps {
  sessions: Session[];
  currentSessionId: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onSessionSelect: (session: Session) => void;
  onNewSession: () => void;
  onSessionsChange: () => void;
}

export function SessionPane({
  sessions,
  currentSessionId,
  isOpen,
  onToggle,
  onSessionSelect,
  onNewSession,
  onSessionsChange,
}: SessionPaneProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  
  // Folders state
  const [folders, setFolders] = useState<SessionFolder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [deleteFolderDialogOpen, setDeleteFolderDialogOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<SessionFolder | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced search effect
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/sessions/search?q=${encodeURIComponent(searchQuery)}`);
        if (response.ok) {
          const results = await response.json();
          setSearchResults(results);
        }
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSearchResultClick = (result: SearchResult) => {
    console.log("[Search] Clicked on result:", result.id, result.title);
    // Find the session in our sessions list or create a minimal session object
    const existingSession = sessions.find(s => s.id === result.id);
    console.log("[Search] Found existing session:", existingSession?.id);
    const session = existingSession || {
      id: result.id,
      title: result.title,
      createdAt: result.updatedAt || new Date().toISOString(),
      updatedAt: result.updatedAt || new Date().toISOString(),
    };
    console.log("[Search] Calling onSessionSelect with:", session.id);
    onSessionSelect(session);
    setSearchQuery("");
    setSearchResults([]);
  };

  // Fetch folders on mount and when sessions change
  useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    try {
      const response = await fetch("/api/folders");
      if (response.ok) {
        const data = await response.json();
        setFolders(data);
      }
    } catch (error) {
      console.error("Failed to fetch folders:", error);
    }
  };

  const handleRename = useCallback((session: Session) => {
    setEditingId(session.id);
    setEditTitle(session.title);
  }, []);

  const handleSaveRename = useCallback(async () => {
    if (!editingId || !editTitle.trim()) return;

    try {
      const response = await fetch(`/api/sessions/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim() }),
      });

      if (response.ok) {
        onSessionsChange();
        toast.success("Session renamed");
      } else {
        toast.error("Failed to rename session");
      }
    } catch (error) {
      console.error("Rename error:", error);
      toast.error("Failed to rename session");
    } finally {
      setEditingId(null);
      setEditTitle("");
    }
  }, [editingId, editTitle, onSessionsChange]);

  const handleCancelRename = useCallback(() => {
    setEditingId(null);
    setEditTitle("");
  }, []);

  const handleDeleteClick = useCallback((session: Session) => {
    setSessionToDelete(session);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!sessionToDelete) return;

    try {
      const response = await fetch(`/api/sessions/${sessionToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        onSessionsChange();
        toast.success("Session deleted");
        
        if (sessionToDelete.id === currentSessionId) {
          onNewSession();
        }
      } else {
        toast.error("Failed to delete session");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete session");
    } finally {
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    }
  }, [sessionToDelete, currentSessionId, onSessionsChange, onNewSession]);

  // Pin/Unpin handlers
  const handlePin = useCallback(async (session: Session) => {
    try {
      const response = await fetch(`/api/sessions/${session.id}/pin`, {
        method: "POST",
      });

      if (response.ok) {
        onSessionsChange();
        toast.success("Session pinned");
      } else {
        const data = await response.json();
        if (data.code === "MAX_PINS_REACHED") {
          toast.error(`Maximum of ${data.maxPins} pinned sessions reached. Please unpin a session first.`);
        } else {
          toast.error("Failed to pin session");
        }
      }
    } catch (error) {
      console.error("Pin error:", error);
      toast.error("Failed to pin session");
    }
  }, [onSessionsChange]);

  const handleUnpin = useCallback(async (session: Session) => {
    try {
      const response = await fetch(`/api/sessions/${session.id}/pin`, {
        method: "DELETE",
      });

      if (response.ok) {
        onSessionsChange();
        toast.success("Session unpinned");
      } else {
        toast.error("Failed to unpin session");
      }
    } catch (error) {
      console.error("Unpin error:", error);
      toast.error("Failed to unpin session");
    }
  }, [onSessionsChange]);

  // Move to folder handler
  const handleMoveToFolder = useCallback(async (session: Session, folderId: string | null) => {
    try {
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      });

      if (response.ok) {
        onSessionsChange();
        toast.success(folderId ? "Moved to folder" : "Removed from folder");
      } else {
        toast.error("Failed to move session");
      }
    } catch (error) {
      console.error("Move error:", error);
      toast.error("Failed to move session");
    }
  }, [onSessionsChange]);

  // Folder CRUD handlers
  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;

    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName.trim() }),
      });

      if (response.ok) {
        await fetchFolders();
        setNewFolderName("");
        setIsCreatingFolder(false);
        toast.success("Folder created");
      } else {
        toast.error("Failed to create folder");
      }
    } catch (error) {
      console.error("Create folder error:", error);
      toast.error("Failed to create folder");
    }
  }, [newFolderName]);

  const handleRenameFolder = useCallback((folder: SessionFolder) => {
    setEditingFolderId(folder.id);
    setEditFolderName(folder.name);
  }, []);

  const handleSaveFolderRename = useCallback(async () => {
    if (!editingFolderId || !editFolderName.trim()) return;

    try {
      const response = await fetch(`/api/folders/${editingFolderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editFolderName.trim() }),
      });

      if (response.ok) {
        await fetchFolders();
        toast.success("Folder renamed");
      } else {
        toast.error("Failed to rename folder");
      }
    } catch (error) {
      console.error("Rename folder error:", error);
      toast.error("Failed to rename folder");
    } finally {
      setEditingFolderId(null);
      setEditFolderName("");
    }
  }, [editingFolderId, editFolderName]);

  const handleDeleteFolderClick = useCallback((folder: SessionFolder) => {
    setFolderToDelete(folder);
    setDeleteFolderDialogOpen(true);
  }, []);

  const handleConfirmDeleteFolder = useCallback(async () => {
    if (!folderToDelete) return;

    try {
      const response = await fetch(`/api/folders/${folderToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchFolders();
        onSessionsChange();
        toast.success("Folder deleted");
      } else {
        toast.error("Failed to delete folder");
      }
    } catch (error) {
      console.error("Delete folder error:", error);
      toast.error("Failed to delete folder");
    } finally {
      setDeleteFolderDialogOpen(false);
      setFolderToDelete(null);
    }
  }, [folderToDelete, onSessionsChange]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Separate pinned sessions, folder sessions, and unfiled sessions
  const pinnedSessions = sessions.filter(s => s.isPinned && !s.folderId);
  const unfiledUnpinnedSessions = sessions.filter(s => !s.isPinned && !s.folderId);
  
  // Group unfiled sessions by date
  const groupedSessions = unfiledUnpinnedSessions.reduce((groups, session) => {
    const date = new Date(session.updatedAt);
    const key = date.toDateString();
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(session);
    return groups;
  }, {} as Record<string, Session[]>);

  // Get sessions for each folder (including pinned ones in folders)
  const getSessionsInFolder = (folderId: string) => {
    return sessions.filter(s => s.folderId === folderId);
  };

  // Render a session item
  const renderSessionItem = (session: Session, showPinIcon = false) => (
    <div
      key={session.id}
      className={cn(
        "group rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-muted",
        session.id === currentSessionId && "bg-muted"
      )}
      onClick={() => {
        if (editingId !== session.id) {
          onSessionSelect(session);
        }
      }}
    >
      {editingId === session.id ? (
        <div className="flex items-center gap-1">
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveRename();
              if (e.key === "Escape") handleCancelRename();
            }}
            className="h-6 text-sm flex-1"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              handleSaveRename();
            }}
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              handleCancelRename();
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center w-full">
          {showPinIcon && session.isPinned ? (
            <Pin className="h-4 w-4 mr-2 shrink-0 text-primary" />
          ) : (
            <MessageSquare className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate text-sm flex-1 min-w-0 mr-1">{session.title}</span>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Pin/Unpin option */}
              {session.isPinned ? (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUnpin(session);
                  }}
                >
                  <PinOff className="h-4 w-4 mr-2" />
                  Unpin
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePin(session);
                  }}
                >
                  <Pin className="h-4 w-4 mr-2" />
                  Pin
                </DropdownMenuItem>
              )}
              
              <DropdownMenuSeparator />
              
              {/* Move to folder submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderInput className="h-4 w-4 mr-2" />
                  Move to folder
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveToFolder(session, null);
                    }}
                    disabled={!session.folderId}
                  >
                    <X className="h-4 w-4 mr-2" />
                    No folder
                  </DropdownMenuItem>
                  {folders.length > 0 && <DropdownMenuSeparator />}
                  {folders.map(folder => (
                    <DropdownMenuItem
                      key={folder.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveToFolder(session, folder.id);
                      }}
                      disabled={session.folderId === folder.id}
                    >
                      <Folder className="h-4 w-4 mr-2" />
                      {folder.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleRename(session);
                }}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(session);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );

  if (!isOpen) {
    return (
      <div className="border-r flex flex-col items-center py-4 w-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="mb-2"
          title="Show chat history"
        >
          <MessageSquare className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="border-r flex flex-col bg-muted/30 w-72 min-w-[288px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <h2 className="font-semibold text-sm">Chat History</h2>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onNewSession}
              title="New chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onToggle}
              title="Hide panel"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search Input */}
        <div className="px-3 py-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Search Results - shown instead of sessions list when searching */}
        {(searchResults.length > 0 || isSearching) && searchQuery.length >= 2 ? (
          <ScrollArea className="flex-1 overflow-hidden">
            <div className="p-2">
              {isSearching ? (
                <div className="p-3 text-sm text-muted-foreground text-center">
                  Searching...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground text-center">
                  No results found
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 mb-2">
                    Search Results
                  </div>
                  {searchResults.map((result) => (
                    <div
                      key={result.id}
                      className="px-2 py-2 hover:bg-muted cursor-pointer rounded-md"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSearchResultClick(result);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm truncate">{result.title}</span>
                      </div>
                      {result.snippet && (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2 pl-6">
                          {result.snippet}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        ) : (
          /* Sessions list */
          <ScrollArea className="flex-1 overflow-hidden">
          <div className="p-2 space-y-3 overflow-hidden">
            {/* Folders Section */}
            {(folders.length > 0 || isCreatingFolder) && (
              <div className="space-y-1 overflow-hidden">
                <div className="flex items-center gap-2 px-2 overflow-hidden">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Folders
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0"
                    onClick={() => setIsCreatingFolder(true)}
                    title="Click to create new folder"
                  >
                    <FolderPlus className="h-3 w-3" />
                  </Button>
                </div>
                
                {/* New folder input */}
                {isCreatingFolder && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50">
                    <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <Input
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateFolder();
                        if (e.key === "Escape") {
                          setIsCreatingFolder(false);
                          setNewFolderName("");
                        }
                      }}
                      placeholder="Folder name..."
                      className="h-6 text-sm flex-1 min-w-0"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={handleCreateFolder}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => {
                        setIsCreatingFolder(false);
                        setNewFolderName("");
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                
                {/* Folder list */}
                {folders.map(folder => {
                  const folderSessions = getSessionsInFolder(folder.id);
                  const isExpanded = expandedFolders.has(folder.id);
                  
                  return (
                    <Collapsible
                      key={folder.id}
                      open={isExpanded}
                      onOpenChange={() => toggleFolder(folder.id)}
                    >
                      <div className="group rounded-md hover:bg-muted overflow-hidden">
                        {editingFolderId === folder.id ? (
                          <div className="flex items-center gap-1 px-2 py-1">
                            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <Input
                              value={editFolderName}
                              onChange={(e) => setEditFolderName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveFolderRename();
                                if (e.key === "Escape") {
                                  setEditingFolderId(null);
                                  setEditFolderName("");
                                }
                              }}
                              className="h-6 text-sm flex-1 min-w-0"
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={handleSaveFolderRename}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => {
                                setEditingFolderId(null);
                                setEditFolderName("");
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center px-2 py-1 overflow-hidden">
                            <CollapsibleTrigger className="flex items-center flex-1 min-w-0 text-left">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                              )}
                              {isExpanded ? (
                                <FolderOpen className="h-4 w-4 mx-1 shrink-0 text-muted-foreground" />
                              ) : (
                                <Folder className="h-4 w-4 mx-1 shrink-0 text-muted-foreground" />
                              )}
                              <span className="truncate text-sm min-w-0 text-left">
                                {folder.name}
                              </span>
                              <span className="text-xs text-muted-foreground ml-1 shrink-0">
                                ({folderSessions.length})
                              </span>
                            </CollapsibleTrigger>
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground ml-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRenameFolder(folder);
                                  }}
                                >
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteFolderClick(folder);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </div>
                      <CollapsibleContent>
                        <div className="pl-6 space-y-0.5">
                          {folderSessions.length === 0 ? (
                            <div className="text-xs text-muted-foreground py-1 px-2">
                              No sessions
                            </div>
                          ) : (
                            folderSessions.map(session => renderSessionItem(session, true))
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            )}
            
            {/* New Folder button when no folders exist */}
            {folders.length === 0 && !isCreatingFolder && (
              <Button
                variant="ghost"
                className="w-full justify-start text-muted-foreground h-8"
                onClick={() => setIsCreatingFolder(true)}
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                <span className="text-sm">New folder</span>
              </Button>
            )}

            {/* Pinned Section */}
            {pinnedSessions.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2">
                  Pinned
                </div>
                <div className="space-y-0.5">
                  {pinnedSessions.map(session => renderSessionItem(session, true))}
                </div>
              </div>
            )}

            {/* Regular sessions grouped by date */}
            {Object.entries(groupedSessions)
              .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
              .map(([dateKey, dateSessions]) => (
                <div key={dateKey} className="space-y-1">
                  <div className="text-xs text-muted-foreground px-2">
                    {formatDate(dateSessions[0].updatedAt)}
                  </div>
                  <div className="space-y-0.5">
                    {dateSessions.map(session => renderSessionItem(session))}
                  </div>
                </div>
              ))}

            {sessions.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8">
                No conversations yet
              </div>
            )}
          </div>
        </ScrollArea>
        )}
      </div>

      {/* Delete session confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{sessionToDelete?.title}&quot; and all its messages.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete folder confirmation dialog */}
      <AlertDialog open={deleteFolderDialogOpen} onOpenChange={setDeleteFolderDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the folder &quot;{folderToDelete?.name}&quot;. 
              Sessions in this folder will be moved to the main list.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteFolder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
