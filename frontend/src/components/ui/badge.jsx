import React from 'react';
import { cn } from '../../lib/utils';

export function Badge({ className, variant = 'outline', children, ...props }) {
  const base = 'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium';
  const variants = {
    outline: 'background:#fff; color:#374151; border:1px solid #d1d5db;',
  };

  return (
    <span className={cn(base, className)} style={styleFromString(variants[variant] || variants.outline)} {...props}>
      {children}
    </span>
  );
}

function styleFromString(styleText) {
  return styleText.split(';').reduce((acc, rule) => {
    const [prop, value] = rule.split(':').map((item) => item?.trim());
    if (!prop || !value) return acc;
    const camel = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    acc[camel] = value;
    return acc;
  }, {});
}
