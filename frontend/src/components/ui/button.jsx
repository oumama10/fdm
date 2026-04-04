import React from 'react';

const variantStyles = {
  default: { background: '#111827', color: '#fff', border: '1px solid #111827' },
  destructive: { background: '#b91c1c', color: '#fff', border: '1px solid #b91c1c' },
  outline: { background: '#fff', color: '#111827', border: '1px solid #d1d5db' },
  secondary: { background: '#f3f4f6', color: '#111827', border: '1px solid #e5e7eb' },
  ghost: { background: 'transparent', color: '#111827', border: '1px solid transparent' },
  link: { background: 'transparent', color: '#2563eb', border: 'none', textDecoration: 'underline' },
};

const sizeStyles = {
  default: { height: 40, padding: '0 16px', fontSize: 14 },
  sm: { height: 36, padding: '0 12px', fontSize: 13 },
  lg: { height: 44, padding: '0 20px', fontSize: 15 },
  icon: { height: 40, width: 40, padding: 0, fontSize: 14 },
};

export const Button = React.forwardRef(function Button(
  { className, variant = 'default', size = 'default', style, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      style={{
        borderRadius: 8,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.6 : 1,
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style,
      }}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
});
