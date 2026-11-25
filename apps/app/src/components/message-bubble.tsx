"use client";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useCallback, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useMessageReactions } from "~/lib/hooks/use-message-reactions";
import { soundEffects } from "~/lib/sound-effects";
import { cn } from "~/lib/utils";
import type { MessageReaction, MessageWithReactions } from "~/server/db/schema";
import type { ReactionType } from "~/types";

// Props for the MessageBubble component
interface MessageBubbleProps {
  message: MessageWithReactions;
  isLastUserMessage?: boolean;
  isTyping?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  onReactionComplete?: () => void;
  justSent?: boolean;
  isMobileView?: boolean;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>
export function MessageBubble({
  message,
  isLastUserMessage,
  isTyping,
  onOpenChange,
  onReactionComplete,
  justSent = false,
  isMobileView = false,
}: MessageBubbleProps) {
  const { addReaction, removeReaction, isPending } = useMessageReactions(
    message.id
  );
  // Determine message sender type and display name
  const isSystemMessage = message.role === "system";
  const isMe = message.role === "user";
  const showRecipientName = !(isMe || isSystemMessage);
  const recipientName = showRecipientName ? message.role : null;

  // Map of reaction types to their SVG paths for the menu
  const { theme, systemTheme } = useTheme();
  const effectiveTheme = theme === "system" ? systemTheme : theme;

  const menuReactionIcons = {
    heart: "reactions/heart-gray.svg",
    like: "reactions/like-gray.svg",
    dislike: "reactions/dislike-gray.svg",
    laugh: "reactions/laugh-gray.svg",
    emphasize: "reactions/emphasize-gray.svg",
    question: "reactions/question-gray.svg",
  };

  // State to control the Popover open state and animation
  const [isOpen, setIsOpen] = useState(false);
  const openTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handler for menu state changes
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        // Only open if we're not in a closing state
        if (openTimeoutRef.current) {
          clearTimeout(openTimeoutRef.current);
        }
        openTimeoutRef.current = setTimeout(() => {
          setIsOpen(true);
          onOpenChange?.(true);
        }, 10);
      } else {
        // Menu is closing
        setIsOpen(false);
        onOpenChange?.(false);
      }
    },
    [onOpenChange]
  );

  // Check if user has reacted with this type
  const isReactionActive = (type: ReactionType) =>
    message.reactions?.some(
      (r) => r.reactorRole === "user" && r.type === type
    ) ?? false;

  // Handler for when a reaction is clicked
  const handleReaction = useCallback(
    (type: ReactionType) => {
      // Play sound for any reaction action
      soundEffects.playReactionSound();

      // Toggle reaction based on current state
      const active = isReactionActive(type);
      if (active) {
        removeReaction();
      } else {
        addReaction(type);
      }

      // Close menu and focus input with delay
      setTimeout(() => {
        setIsOpen(false);
        onOpenChange?.(false);
        onReactionComplete?.();
      }, 500);
    },
    [addReaction, removeReaction, onOpenChange, onReactionComplete]
  );

  // Helper function to prepare message content (simplified - no recipient highlighting for now)
  const prepareContent = (content: string) => content;

  // Helper function to get reaction verb
  const getReactionVerb = (type: ReactionType) => {
    switch (type) {
      case "heart":
        return "loved";
      case "like":
        return "liked";
      case "dislike":
        return "disliked";
      case "laugh":
        return "laughed at";
      case "emphasize":
        return "emphasized";
      case "question":
        return "questioned";
      default:
        return "reacted to";
    }
  };

  // Helper function to format reactions
  const formatReactions = (reactions: MessageReaction[]) =>
    reactions
      .map((reaction) => {
        const name = reaction.reactorRole === "user" ? "You" : "Assistant";
        const verb = getReactionVerb(reaction.type as ReactionType);
        return `${name} ${verb} this message`;
      })
      .join(", ");

  const rightBubbleSvg =
    effectiveTheme === "dark"
      ? "/message-bubbles/right-bubble-dark.svg"
      : "/message-bubbles/right-bubble-light.svg";
  const leftBubbleSvg =
    effectiveTheme === "dark"
      ? "/message-bubbles/left-bubble-dark.svg"
      : "/message-bubbles/left-bubble-light.svg";
  const typingIndicatorSvg =
    effectiveTheme === "dark"
      ? "/typing-bubbles/chat-typing-dark.svg"
      : "/typing-bubbles/chat-typing-light.svg";

  const getReactionIconSvg = (
    reactionFromMe: boolean,
    messageFromMe: boolean,
    reactionType: ReactionType,
    isMobileView: boolean,
    overlay?: boolean
  ) => {
    const orientation = messageFromMe ? "left" : "right";
    const baseVariant = effectiveTheme === "dark" ? "dark" : "light";

    // If overlay is true, always use the base variant without "-blue"
    if (overlay) {
      return `reactions/${orientation}-${baseVariant}-${reactionType}-overlay.svg`;
    }

    // Otherwise, if the reaction is from me and we're in mobile view, use the blue variant
    const variant =
      reactionFromMe && isMobileView ? `${baseVariant}-blue` : baseVariant;

    return `reactions/${orientation}-${variant}-${reactionType}.svg`;
  };

  const getReactionStyle = (
    reaction: MessageReaction,
    isMe: boolean,
    isMobileView: boolean
  ) => {
    const reactionFromUser = reaction.reactorRole === "user";

    const iconUrl = getReactionIconSvg(
      reactionFromUser,
      isMe,
      reaction.type as ReactionType,
      isMobileView
    );

    const mobileStyle = {
      backgroundImage: `url('${iconUrl}')`,
      backgroundSize: "contain",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "center",
    };

    if (isMobileView || !reactionFromUser) {
      return mobileStyle;
    }

    return {
      WebkitMaskImage: `url('${iconUrl}')`,
      maskImage: `url('${iconUrl}')`,
      WebkitMaskSize: "contain",
      maskSize: "contain",
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
      maskPosition: "center",
      background: "linear-gradient(to bottom, #47B5FF, #0A7CFF)",
      backgroundAttachment: "fixed",
    };
  };

  return (
    <div className="relative z-10 flex w-full flex-col">
      {/* Spacer before messages */}
      <div className="h-1" />
      {/* Extra space between messages with reactions */}
      <div
        className={`overflow-hidden transition-[height] duration-500 ease-in-out ${
          message.reactions && message.reactions.length > 0
            ? isMe
              ? "h-4"
              : "h-2"
            : "h-0"
        }`}
      />

      {/* Show recipient name for messages from others */}
      {recipientName && (
        <div className="pb-0.5 pl-4 text-[10px] text-muted-foreground">
          Carol
        </div>
      )}

      <div className="flex">
        {/* Left spacer for blue messages */}
        {isMe && <div className="flex-1" />}
        {/* Message bubble container */}
        {isSystemMessage ? (
          <div
            className={cn(
              "flex w-full justify-center px-3 py-2",
              isSystemMessage && ""
            )}
          >
            <div
              className={cn(
                "max-w-[80%] whitespace-pre-line text-center text-muted-foreground text-xs"
              )}
            >
              {message.content}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "group relative max-w-[75%] flex-none break-words",
              isSystemMessage
                ? "rounded-lg bg-muted/50 text-center"
                : isTyping
                  ? "border-[17px] border-l-[22px] border-solid bg-gray-100 text-gray-900 dark:bg-[#404040] dark:text-gray-100"
                  : isMe
                    ? cn(
                        "border-[17px] border-r-[22px] border-solid text-white",
                        isMobileView
                          ? "bg-[#0A7CFF]"
                          : "bg-[linear-gradient(#47B5FF,#0A7CFF)] bg-fixed"
                      )
                    : "border-[17px] border-l-[22px] border-solid bg-gray-100 text-gray-900 dark:bg-[#404040] dark:text-gray-100"
            )}
            style={
              isSystemMessage
                ? undefined
                : {
                    borderImageSlice: isMe ? "31 43 31 31" : "31 31 31 43",
                    borderImageSource: `url('${
                      isMe
                        ? rightBubbleSvg
                        : isTyping
                          ? typingIndicatorSvg
                          : leftBubbleSvg
                    }')`,
                  }
            }
          >
            <div className={cn(!isTyping && "-my-2.5 -mx-1")}>
              {/* Message content or typing indicator */}
              <Popover
                modal={true}
                onOpenChange={handleOpenChange}
                open={isOpen}
              >
                <PopoverTrigger>
                  <div className="flex cursor-pointer flex-col">
                    {/* Add this to cover up the right border */}
                    <div
                      className={cn(
                        "absolute border-background border-r-[0.5px]",
                        isMe ? "inset-[-22px]" : "inset-[-17px]"
                      )}
                    />
                    <div
                      className={cn(
                        "whitespace-pre-wrap break-words text-left text-sm",
                        !isMe && "prose prose-sm dark:prose-invert max-w-none"
                      )}
                    >
                      {prepareContent(message.content ?? "")}
                    </div>
                  </div>
                </PopoverTrigger>
                {/* Reaction menu */}
                <PopoverContent
                  align={isMe ? "end" : "start"}
                  className="reaction-menu z-50 flex w-fit gap-2 rounded-full bg-gray-100 p-2 dark:bg-[#404040]"
                  sideOffset={20}
                >
                  {/* Reaction buttons */}
                  {Object.entries(menuReactionIcons).map(([type, icon]) => (
                    <button
                      className={cn(
                        "inline-flex aspect-square h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-full p-0 text-base text-gray-500 transition-all duration-200 ease-out hover:scale-125",
                        isReactionActive(type as ReactionType)
                          ? "scale-110 bg-[#0A7CFF] text-white"
                          : ""
                      )}
                      disabled={isPending}
                      key={type}
                      onClick={() => {
                        handleReaction(type as ReactionType);
                      }}
                      type="button"
                    >
                      <Image
                        alt={`${type} reaction`}
                        height={16}
                        src={
                          isReactionActive(type as ReactionType)
                            ? icon
                                .replace("-gray", "-white")
                                .replace("-dark", "-white")
                            : icon
                        }
                        style={
                          type === "emphasize"
                            ? { transform: "scale(0.75)" }
                            : type === "question"
                              ? { transform: "scale(0.6)" }
                              : undefined
                        }
                        width={16}
                      />
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
              {/* Display existing reactions */}
              {message.reactions && message.reactions.length > 0 && (
                <div
                  className={cn(
                    "-top-8 absolute flex",
                    isMe ? "-left-8" : "-right-8",
                    isMe ? "flex-row" : "flex-row-reverse"
                  )}
                >
                  {message.reactions
                    .sort(
                      (a, b) =>
                        new Date(a.createdAt).getTime() -
                        new Date(b.createdAt).getTime()
                    )
                    .map((reaction, index, array) => (
                      <Popover key={`${reaction.reactorRole}-${reaction.type}`}>
                        <PopoverTrigger>
                          <div
                            className={cn(
                              "relative flex h-8 w-8 cursor-pointer items-center justify-center text-sm",
                              index !== array.length - 1 &&
                                (isMe ? "-mr-7" : "-ml-7"),
                              `z-[${array.length - index}]`
                            )}
                            style={getReactionStyle(
                              reaction,
                              isMe,
                              isMobileView
                            )}
                          >
                            {reaction.reactorRole === "user" &&
                              !isMobileView && (
                                <Image
                                  alt={`${reaction.type} reaction`}
                                  className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 z-10"
                                  height={32}
                                  src={getReactionIconSvg(
                                    true,
                                    isMe,
                                    reaction.type as ReactionType,
                                    isMobileView,
                                    true
                                  )}
                                  width={32}
                                />
                              )}
                          </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-fit max-w-[200px] break-words border-gray-100 bg-gray-100 px-3 py-1.5 dark:border-[#404040] dark:bg-[#404040]">
                          <p className="text-sm">
                            {formatReactions(message.reactions)}
                          </p>
                        </PopoverContent>
                      </Popover>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
        {/* Right spacer for gray messages */}
        {!(isSystemMessage || isMe) && <div className="flex-1" />}
      </div>

      {/* Show "Delivered" for last message from current user */}
      {isMe && isLastUserMessage && !isTyping && (
        <div className="pt-1 pr-1 text-right text-[10px] text-gray-500">
          <span className={cn(justSent && "animate-scale-in")}>Delivered</span>
        </div>
      )}
      {/* Spacer after messages */}
      <div className="h-1" />
    </div>
  );
}
