import { ChatPageContent } from "@/components/chat/chat-page-content";

// Root page renders the chat interface (same as /chat for new chats)
// This maintains backward compatibility while the new /chat and /chat/[sessionId] routes
// provide URL-based navigation with proper right-click "Open in new window" support
export default function HomePage() {
  return <ChatPageContent />;
}
