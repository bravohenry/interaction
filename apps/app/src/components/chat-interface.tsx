"use client";
import { cva } from "class-variance-authority";
import { memo } from "react";
import { StickToBottom } from "use-stick-to-bottom";
import type { ChatMessage } from "~/lib/hooks/use-chat";
import { useChat } from "~/lib/hooks/use-chat";
import { Composer } from "./composer";
import { MessageBubble } from "./message-bubble";

interface ChatMessageGroup {
  id: string;
  role: "user" | "assistant";
  messages: ChatMessage[];
}

function groupMessages(messages: ChatMessage[]): ChatMessageGroup[] {
  const groups: ChatMessageGroup[] = [];
  let current: ChatMessageGroup | null = null;

  for (const m of messages) {
    const role: "user" | "assistant" =
      m.role === "system" || m.role === "assistant" ? "assistant" : "user";
    if (!current || current.role !== role) {
      current = { id: `g-${m.id}`, role, messages: [m] };
      groups.push(current);
    } else {
      current.messages.push(m);
    }
  }

  return groups;
}

const messageGroupVariants = cva("flex flex-col gap-1", {
  variants: {
    role: {
      user: "items-end",
      assistant: "items-start",
    },
  },
});

const ChatMessageGroupViewImpl = memo(
  function ChatMessageGroupViewViewComponent({
    groupData,
    isLastUserGroup,
  }: {
    groupData: ChatMessageGroup;
    isLastUserGroup: boolean;
  }) {
    return (
      <div className={messageGroupVariants({ role: groupData.role })}>
        {groupData.messages.map((m, idx) => {
          const isLastInGroup = idx === groupData.messages.length - 1;
          const isLastUserMessage =
            groupData.role === "user" && isLastUserGroup && isLastInGroup;

          return (
            <MessageBubble
              isLastUserMessage={isLastUserMessage}
              key={m.id}
              message={m}
            />
          );
        })}
      </div>
    );
  }
);

export function ChatInterface() {
  const { messages, input, handleInputChange, handleSubmit, error, isSending } =
    useChat();

  const groups = groupMessages(messages);

  // Find the last user group index
  const lastUserGroupIndex = groups.findLastIndex((g) => g.role === "user");

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-background pb-6 text-foreground">
      <StickToBottom
        className="min-h-0 w-full flex-1"
        initial="smooth"
        resize="smooth"
      >
        <StickToBottom.Content className="h-full overflow-y-auto px-4 pt-2 pb-3">
          {messages.length === 0 && (
            <div className="py-10 text-center text-muted-foreground text-sm">
              Start a conversation
            </div>
          )}

          <div aria-live="polite" aria-relevant="additions" role="log">
            <div className="flex flex-col gap-3">
              {groups.map((g, idx) => (
                <ChatMessageGroupViewImpl
                  groupData={g}
                  isLastUserGroup={idx === lastUserGroupIndex}
                  key={g.id}
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-lg bg-destructive/10 p-3 text-destructive text-sm">
              Error: {error?.message || "An error occurred"}
            </div>
          )}
        </StickToBottom.Content>
      </StickToBottom>

      <Composer
        disabled={isSending}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        value={input}
      />
    </div>
  );
}
