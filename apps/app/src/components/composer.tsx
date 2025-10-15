"use client";

import {
  MicrophoneIcon,
  PaperclipIcon,
  PaperPlaneTiltIcon,
  SmileyIcon,
  StickerIcon,
} from "@phosphor-icons/react";
import type { Transition } from "motion/react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import TextareaAutosize from "react-textarea-autosize";
import { Button } from "~/components/ui/button";

interface ComposerProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  disabled?: boolean;
  animationDuration?: number;
}

export function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
  animationDuration = 0.4,
}: ComposerProps) {
  const isEmpty = value.length === 0;

  const transition: Transition = {
    duration: animationDuration,
    type: "spring",
    bounce: 0,
    filter: {
      duration: animationDuration * 0.9,
      type: "spring",
      bounce: 0,
    },
  };

  const boxShadow =
    "inset 0px 2px 2px 0px rgb(255 255 255 / 0.3), inset 0px -1px 2px 0px rgb(0 0 0 / 0.12)";

  return (
    <MotionConfig transition={transition}>
      <form
        className="relative z-10 flex w-full items-end gap-2 px-2 py-2 sm:px-3 md:px-4"
        onSubmit={onSubmit}
      >
        <Button
          aria-label="Add Attachment"
          className="size-11 rounded-full bg-secondary/80 text-muted-foreground backdrop-blur-sm transition-colors sm:size-12 md:size-13"
          size="icon"
          style={{
            boxShadow,
          }}
          type="button"
          variant="secondary"
        >
          <PaperclipIcon aria-hidden="true" className="size-6 sm:size-7" />
        </Button>
        <motion.div
          className="flex min-h-11 flex-1 items-center overflow-hidden bg-secondary/80 px-2 py-1 backdrop-blur-sm will-change-transform sm:min-h-12 sm:px-2.5 sm:py-1.5 md:min-h-13 md:px-3 md:py-2"
          layout
          layoutDependency={value}
          style={{
            borderRadius: 27,
            boxShadow,
          }}
        >
          <div className="min-w-0 flex-1 overflow-hidden">
            <motion.div
              className="flex"
              layout="preserve-aspect"
              layoutDependency={value}
            >
              <TextareaAutosize
                autoFocus
                className="h-auto w-full min-w-0 resize-none text-ellipsis bg-transparent px-2 py-2 font-medium text-[15px] leading-6 outline-none placeholder:text-muted-foreground sm:px-2.5 [&::-webkit-scrollbar]:hidden"
                disabled={disabled}
                id="message-input"
                maxRows={10}
                minRows={1}
                onChange={onChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    (
                      e.currentTarget.form as HTMLFormElement | null
                    )?.requestSubmit();
                  }
                }}
                placeholder="Message"
                value={value}
              />
            </motion.div>
          </div>
          <motion.div
            className="relative flex shrink-0 items-center gap-1 pl-1 sm:gap-1.5 md:gap-2"
            layout="preserve-aspect"
            layoutDependency={value}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {isEmpty ? (
                <Button
                  aria-label="Open Sticker Picker"
                  asChild
                  className="size-8 rounded-full text-muted-foreground transition-colors will-change-[transform,opacity,filter] sm:size-9"
                  key="stickers-button"
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <motion.button
                    animate={{
                      scale: 1,
                      opacity: 1,
                      filter: "none",
                    }}
                    exit={{
                      scale: 0.4,
                      opacity: 0,
                      filter: "blur(5px)",
                    }}
                    initial={{
                      scale: 0.4,
                      opacity: 0,
                      filter: "blur(5px)",
                    }}
                  >
                    <StickerIcon
                      aria-hidden="true"
                      className="size-6 sm:size-7"
                    />
                  </motion.button>
                </Button>
              ) : (
                <Button
                  aria-label="Open Emoji Picker"
                  asChild
                  className="size-9 rounded-full text-muted-foreground transition-colors will-change-[transform,opacity,filter]"
                  key="emojis-button"
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <motion.button
                    animate={{
                      scale: 1,
                      opacity: 1,
                      filter: "none",
                    }}
                    exit={{
                      scale: 0.4,
                      opacity: 0,
                      filter: "blur(5px)",
                    }}
                    initial={{
                      scale: 0.4,
                      opacity: 0,
                      filter: "blur(5px)",
                    }}
                  >
                    <SmileyIcon aria-hidden="true" className="size-7" />
                  </motion.button>
                </Button>
              )}
            </AnimatePresence>
            <AnimatePresence
              anchorX="right"
              initial={false}
              mode="popLayout"
              propagate
            >
              {!isEmpty && (
                <Button
                  aria-label="Send"
                  asChild
                  className="relative left-0 h-9 w-13.5 origin-left overflow-hidden rounded-full transition-colors will-change-[transform,opacity,filter]"
                  disabled={disabled || !value.trim()}
                  key="submit-button"
                  size="icon"
                  style={{
                    boxShadow,
                    borderRadius: 18,
                  }}
                  type="submit"
                >
                  <motion.button
                    animate={{
                      scale: 1,
                      opacity: 1,
                      filter: "none",
                      x: 0,
                    }}
                    exit={{
                      scale: 0.2,
                      opacity: 0,
                      filter: "blur(16px)",
                      x: 44 / 2,
                    }}
                    initial={{
                      scale: 0.2,
                      opacity: 0,
                      filter: "blur(16px)",
                    }}
                    layout="preserve-aspect"
                    layoutDependency={value}
                  >
                    <motion.span
                      animate={{
                        x: 0,
                        scale: 1,
                        transition: {
                          ...transition,
                          delay: 0.05,
                        },
                      }}
                      aria-hidden="true"
                      className="origin-bottom-left"
                      exit={{ x: -8, scale: 0.4 }}
                      initial={{
                        x: -12,
                        scale: 0.4,
                      }}
                    >
                      <PaperPlaneTiltIcon className="size-6" weight="fill" />
                    </motion.span>
                  </motion.button>
                </Button>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
        <AnimatePresence initial={false} mode="popLayout">
          {isEmpty && (
            <Button
              aria-label="Voice Message"
              asChild
              className="size-11 rounded-full bg-secondary/80 text-muted-foreground backdrop-blur-sm transition-colors sm:size-12 md:size-13"
              key="voice-message-button"
              size="icon"
              style={{
                boxShadow,
              }}
              type="button"
              variant="secondary"
            >
              <motion.button
                animate={{ x: 0, scale: 1 }}
                aria-hidden="true"
                className="origin-right"
                exit={{
                  x: "calc(100% + 14px)",
                }}
                initial={{
                  x: "calc(100% + 14px)",
                }}
              >
                <MicrophoneIcon className="size-8" />
              </motion.button>
            </Button>
          )}
        </AnimatePresence>
      </form>
    </MotionConfig>
  );
}
