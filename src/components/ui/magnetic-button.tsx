'use client';

import React, { useRef, useState } from 'react';
import { motion, useSpring } from 'framer-motion';
import { cn } from '../../lib/utils';
import { motionTransitions } from '../../lib/motion-tokens';

export interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  strength?: number; // Distance pull multiplier
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  glow?: boolean;
}

export const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  strength = 0.35,
  variant = 'primary',
  size = 'md',
  className,
  glow = true,
  onClick,
  ...props
}) => {
  const ref = useRef<HTMLButtonElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Smooth physical spring coordinates
  const springX = useSpring(0, { stiffness: 280, damping: 20 });
  const springY = useSpring(0, { stiffness: 280, damping: 20 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);

    springX.set(middleX * strength);
    springY.set(middleY * strength);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    springX.set(0);
    springY.set(0);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const variantStyles = {
    primary: 'bg-ink text-white hover:bg-[#2a2a2a] font-medium cursor-pointer',
    secondary: 'bg-surface text-ink border border-[var(--control)] hover:bg-raised cursor-pointer',
    outline: 'bg-surface text-ink border border-[var(--control)] hover:bg-raised cursor-pointer',
    ghost: 'bg-transparent text-ink-2 hover:text-ink hover:bg-raised cursor-pointer',
  };

  const sizeStyles = {
    sm: 'px-3.5 py-1.5 text-xs rounded-md gap-1.5',
    md: 'px-5 py-2.5 text-sm rounded-[8px] gap-2',
    lg: 'px-7 py-3.5 text-base rounded-[10px] gap-2.5',
  };

  return (
    <motion.button
      ref={ref}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      transition={motionTransitions.springSnappy}
      className={cn(
        'relative inline-flex items-center justify-center transition-colors select-none focus-ring',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...(props as any)}
    >
      {glow && isHovered && (
        <span 
          className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-40 blur-sm bg-gradient-to-r from-transparent via-white/10 to-transparent"
        />
      )}
      <span className="relative z-10 flex items-center gap-2">
        {children}
      </span>
    </motion.button>
  );
};
