import React from 'react';
import { cn } from '@/lib/utils';

const variantClasses = {
  default: 'btn btn-primary',
  destructive: 'btn btn-danger',
  outline: 'btn btn-secondary',
  secondary: 'btn btn-secondary',
  ghost: 'btn bg-transparent text-black/60 border border-transparent hover:bg-black/5',
  link: 'btn bg-transparent border-none text-[var(--brand-700)] underline p-0',
};

const sizeClasses = {
  default: 'h-10 px-4 text-sm',
  sm: 'h-9 px-3 text-xs',
  lg: 'h-11 px-5 text-sm',
  icon: 'h-10 w-10 p-0',
};

export const Button = React.forwardRef(function Button(
  { className, variant = 'default', size = 'default', style, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      style={style}
      className={cn(
        'inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
