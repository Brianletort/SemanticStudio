"use client";

import { useParams } from "next/navigation";
import { ChatPageContent } from "@/components/chat/chat-page-content";

export default function SessionChatPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  // Don't use key prop - it forces remount which breaks streaming callbacks
  // Session changes are handled via useEffect state resets in ChatPageContent
  return <ChatPageContent initialSessionId={sessionId} />;
}
