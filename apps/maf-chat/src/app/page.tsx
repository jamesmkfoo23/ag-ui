import Chat from "@/components/Chat";

export default function Home() {
  const agentUrl = process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8888/agentic_chat";

  return (
    <main style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Chat agentUrl={agentUrl} />
    </main>
  );
}
