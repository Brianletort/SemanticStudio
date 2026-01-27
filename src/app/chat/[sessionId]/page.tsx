"use client";

import { useParams } from "next/navigation";
import { ChatPageContent } from "@/components/chat/chat-page-content";

export default function SessionChatPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  // Use key prop to force remount when sessionId changes, ensuring clean state
  return <ChatPageContent key={sessionId} initialSessionId={sessionId} />;
}
