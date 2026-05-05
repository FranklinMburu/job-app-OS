import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  glow?: 'blue' | 'orange' | 'purple' | 'red' | 'none';
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, glow = 'none', className, ...props }) => {
  const glowClasses = {
    blue: 'neon-glow-blue border-neon-blue/20',
    orange: 'neon-glow-orange border-neon-orange/20',
    purple: 'shadow-[0_0_15px_rgba(157,0,255,0.3)] border-neon-purple/20',
    red: 'neon-glow-error border-red-500/20',
    none: 'border-glass-border',
  };

  return (
    <div 
      className={cn(
        "glass-card p-6 transition-all duration-500",
        glowClasses[glow],
        className
      )} 
      {...props}
    >
      {children}
    </div>
  );
};

interface NeonButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'blue' | 'orange' | 'purple' | 'red' | 'none';
  isLoading?: boolean;
}

export const NeonButton: React.FC<NeonButtonProps> = ({ 
  children, 
  variant = 'blue', 
  isLoading, 
  className, 
  ...props 
}) => {
  const variants = {
    blue: 'bg-neon-blue/10 border-neon-blue text-neon-blue hover:bg-neon-blue hover:text-black shadow-[0_0_10px_rgba(0,243,255,0.2)]',
    orange: 'bg-neon-orange/10 border-neon-orange text-neon-orange hover:bg-neon-orange hover:text-black shadow-[0_0_10px_rgba(255,107,0,0.2)]',
    purple: 'bg-neon-purple/10 border-neon-purple text-neon-purple hover:bg-neon-purple hover:text-black shadow-[0_0_10px_rgba(157,0,255,0.2)]',
    red: 'bg-red-500/10 border-red-500 text-red-500 hover:bg-red-500 hover:text-white',
    none: 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white',
  };

  return (
    <button 
      className={cn(
        "px-6 py-2.5 border rounded-lg font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",
        variants[variant],
        className
      )}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : children}
    </button>
  );
};

interface FuturisticInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const FuturisticInput = React.forwardRef<HTMLInputElement, FuturisticInputProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <div className="space-y-1.5 w-full">
        {label && <label className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">{label}</label>}
        <input
          ref={ref}
          className={cn(
            "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-neon-blue/50 focus:bg-white/10 transition-all duration-300",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

interface FuturisticTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const FuturisticTextarea = React.forwardRef<HTMLTextAreaElement, FuturisticTextareaProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <div className="space-y-1.5 w-full">
        {label && <label className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">{label}</label>}
        <textarea
          ref={ref}
          className={cn(
            "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-neon-blue/50 focus:bg-white/10 transition-all duration-300 min-h-[120px] resize-y futuristic-scroll",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
