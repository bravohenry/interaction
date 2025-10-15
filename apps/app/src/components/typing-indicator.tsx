"use client";

import { motion } from "motion/react";

export function TypingIndicator() {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start"
      initial={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.2 }}
    >
      <div className="mt-3 flex items-center gap-1 rounded-2xl rounded-bl-none bg-[rgb(239,239,244)] px-4 py-3 shadow-xs dark:bg-[rgb(44,44,46)]">
        {[0, 1, 2].map((i) => (
          <motion.div
            animate={{
              opacity: [0.3, 1, 0.3],
            }}
            className="size-2 rounded-full bg-gray-400 dark:bg-gray-500"
            key={i}
            transition={{
              duration: 1.4,
              repeat: Number.POSITIVE_INFINITY,
              delay: i * 0.2,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
