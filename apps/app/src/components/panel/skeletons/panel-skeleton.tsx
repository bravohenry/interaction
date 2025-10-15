import * as motion from "motion/react-client";

export function PanelSkeleton() {
  return (
    <motion.div
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="relative h-dvh w-full transform-gpu overflow-hidden bg-card/90 text-foreground backdrop-blur-xl md:h-[750px] md:max-w-md md:rounded-3xl md:border md:border-border/60 md:shadow-xs md:ring-3 md:ring-black/5"
      initial={{ opacity: 0, scale: 0.98, y: 8 }}
      transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
    >
      <div className="h-full" />
    </motion.div>
  );
}
