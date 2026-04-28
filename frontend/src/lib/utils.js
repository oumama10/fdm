export function cn(...inputs) {
  const flat = [];

  const push = (value) => {
    if (!value) return;
    if (typeof value === 'string') {
      flat.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(push);
      return;
    }
    if (typeof value === 'object') {
      Object.entries(value).forEach(([key, enabled]) => {
        if (enabled) flat.push(key);
      });
    }
  };

  inputs.forEach(push);
  return flat.join(' ');
}

export function formatCategorieName(name) {
  return name
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
