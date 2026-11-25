import type { InferSessionAPI } from "better-auth";
import type { Auth } from "~/server/lib/auth";

export type PanelView =
  | "home"
  | "chat"
  | "settings";

export interface PanelProps {
  initialView?: PanelView;
  serverSession?: InferSessionAPI<Auth> | null;
}

export interface AccountDetailState {
  accountId: string;
  email: string;
}

export type ReactionType =
  | "heart"
  | "like"
  | "dislike"
  | "laugh"
  | "emphasize"
  | "question";

export interface Reaction {
  type: ReactionType;
  sender: string;
  timestamp: string;
}
