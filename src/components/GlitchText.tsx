'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

interface GlitchTextProps {
  text: string;
  className?: string;
}

export default function GlitchText({ text, className = '' }: GlitchTextProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.span
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ cursor: 'default' }}
    >
      {/* Main text */}
      <span className="relative z-10">{text}</span>

      {/* Chromatic aberration layers */}
      <motion.span
        className="absolute inset-0 text-red-500/40 z-0"
        animate={isHovered ? {
          x: [0, -3, 2, -1, 0],
          y: [0, 1, -2, 1, 0],
        } : { x: 0, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        style={{ mixBlendMode: 'screen' }}
        aria-hidden
      >
        {text}
      </motion.span>

      <motion.span
        className="absolute inset-0 text-cyan-500/40 z-0"
        animate={isHovered ? {
          x: [0, 3, -2, 1, 0],
          y: [0, -1, 2, -1, 0],
        } : { x: 0, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        style={{ mixBlendMode: 'screen' }}
        aria-hidden
      >
        {text}
      </motion.span>
    </motion.span>
  );
}
