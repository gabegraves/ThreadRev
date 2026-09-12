"use client";

import { CopilotChat } from "@copilotkit/react-core/v2";

export function ChatTab() {
  return (
    <div className="ck-tr-chat">
      <CopilotChat
        className="ck-chat"
        labels={{
          welcomeMessageText: "Ask what changed and why.",
          chatInputPlaceholder: "Ask about the findings…",
        }}
      />
    </div>
  );
}
