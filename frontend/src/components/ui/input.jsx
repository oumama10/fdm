import React from 'react';

export const Input = React.forwardRef(function Input({ className, style, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={className}
      style={{
        width: '100%',
        height: 40,
        border: '1px solid #d1d5db',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 14,
        ...style,
      }}
      {...props}
    />
  );
});
