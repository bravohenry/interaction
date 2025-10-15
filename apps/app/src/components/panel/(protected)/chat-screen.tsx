"use client";

import { ChatInterface } from "~/components/chat-interface";
import { Screen } from "~/components/screen";

export function ChatScreen() {
  return (
    <Screen headerType="back" headerVariant="solid" title="">
      <ChatInterface />
    </Screen>
  );
}
