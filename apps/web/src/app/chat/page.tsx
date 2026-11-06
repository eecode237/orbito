import { ChatView } from "@/components/chat/chat-view";

export const metadata = { title: "Chat" };

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; agent?: string }>;
}) {
  const params = await searchParams;
  return <ChatView initialQuery={params.q ?? ""} initialAgent={params.agent ?? "auto"} />;
}
