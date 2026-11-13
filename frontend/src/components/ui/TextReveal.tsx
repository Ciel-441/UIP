'use client';

import React from 'react';

interface TextRevealProps {
  text: string;
  className?: string;
  /** Delay before the FIRST word starts (seconds) */
  delay?: number;
  /** Gap between each word's animation start (seconds) */
  wordDelay?: number;
}

/**
 * Pure CSS word-by-word slide-from-left animation.
 * Uses CSS keyframes instead of framer-motion to avoid hydration timing issues.
 */
export default function TextReveal({
  text,
  className,
  delay = 0.1,
  wordDelay = 0.12,
}: TextRevealProps) {
  const words = text.split(' ');

  return (
    <span className={`inline-flex flex-wrap gap-x-[0.28em] ${className ?? ''}`}>
      {words.map((word, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            opacity: 0,
            animation: `wordSlideIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards`,
            animationDelay: `${delay + i * wordDelay}s`,
            willChange: 'transform, opacity',
          }}
        >
          {word}
        </span>
      ))}
    </span>
  );
}
