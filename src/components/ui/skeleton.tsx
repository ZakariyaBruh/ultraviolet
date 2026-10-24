"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../../lib/utils";

export interface SkeletonProps extends React.ComponentProps<"div"> {}

/** A quiet block with a slow light sweep. Size it with className. */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <motion.div
      aria-hidden
      className={cn("rounded-md bg-raised", className)}
      animate={{ opacity: [0.55, 1, 0.55] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      {...(props as object)}
    />
  );
}
const WIDTHS = ["100%", "92%", "84%", "96%"];

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({
  lines = 3,
  className,
}: SkeletonTextProps) {
  return (
    <div aria-hidden className={cn("space-y-2.5", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className="h-3.5"
          style={{ width: i === lines - 1 && lines > 1 ? "62%" : WIDTHS[i % WIDTHS.length] }}
        />
      ))}
    </div>
  );
}

export interface SkeletonAvatarProps {
  size?: number;
  className?: string;
}

export function SkeletonAvatar({ size = 40, className }: SkeletonAvatarProps) {
  return <Skeleton className={cn("shrink-0 rounded-full", className)} style={{ width: size, height: size }} />;
}

export interface SkeletonRevealProps {
  loading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Swap a skeleton for real content. Content eases in (fade, rise, un-blur).
 * Make the skeleton roughly the same size as the content so nothing jumps.
 */
export function SkeletonReveal({
  loading,
  skeleton,
  children,
  className,
}: SkeletonRevealProps) {
  return (
    <div className={className}>
      <AnimatePresence mode="wait" initial={false}>
        {loading ? (
          <motion.div
            key="skeleton"
            role="status"
            aria-busy="true"
            aria-label="Loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            {skeleton}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
