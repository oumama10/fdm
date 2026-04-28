import React from 'react';

export const STAGING_ITEM_LABELS = {
  en_attente: { label: 'En attente', bg: 'bg-amber-50', text: 'text-amber-700' },
  approuve: { label: 'Approuve', bg: 'bg-green-50', text: 'text-green-700' },
  rejete: { label: 'Rejete', bg: 'bg-red-50', text: 'text-red-700' },
  modifie: { label: 'Modifie', bg: 'bg-blue-50', text: 'text-blue-700' },
};

export const IMPORT_STATUT_LABELS = {
  en_attente: { label: 'A envoyer', bg: 'bg-gray-50', text: 'text-gray-600' },
  en_revision: { label: 'En revision', bg: 'bg-blue-50', text: 'text-blue-700' },
  valide: { label: 'Valide', bg: 'bg-green-50', text: 'text-green-700' },
  non_conforme: { label: 'Non conforme', bg: 'bg-red-50', text: 'text-red-700' },
  autre: { label: 'Rejete', bg: 'bg-red-50', text: 'text-red-700' },
};

export const MARCHE_STATUT_LABELS = {
  en_attente_livraison: { label: 'En attente livraison', bg: 'bg-amber-50', text: 'text-amber-700' },
  receptionne_et_stocke: { label: 'En stock', bg: 'bg-green-50', text: 'text-green-700' },
  non_conforme: { label: 'Non conforme', bg: 'bg-red-50', text: 'text-red-700' },
};

export const TYPE_ACQUISITION_LABELS = {
  marche: { label: 'Marche', bg: 'bg-indigo-50', text: 'text-indigo-700' },
  bon_commande: { label: 'Bon commande', bg: 'bg-gray-100', text: 'text-gray-600' },
  donation: { label: 'Don', bg: 'bg-amber-50', text: 'text-amber-700' },
};

function toInlineColors(bgClass, textClass) {
  const bgByClass = {
    'bg-amber-50': '#fffbeb',
    'bg-green-50': '#ecfdf5',
    'bg-red-50': '#fef2f2',
    'bg-blue-50': '#eff6ff',
    'bg-gray-50': '#f9fafb',
    'bg-gray-100': '#f3f4f6',
    'bg-indigo-50': '#eef2ff',
  };
  const textByClass = {
    'text-amber-700': '#b45309',
    'text-green-700': '#15803d',
    'text-red-700': '#b91c1c',
    'text-blue-700': '#1d4ed8',
    'text-gray-600': '#4b5563',
    'text-indigo-700': '#4338ca',
  };

  return {
    background: bgByClass[bgClass] || '#f3f4f6',
    color: textByClass[textClass] || '#4b5563',
  };
}

export function StatusBadge({ map, value }) {
  const entry = map?.[value];
  if (!entry) {
    return React.createElement(
      'span',
      {
        className: 'text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full',
        style: { background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: 999, fontSize: 12 },
      },
      value ?? '-'
    );
  }

  const inlineStyle = toInlineColors(entry.bg, entry.text);
  return React.createElement(
    'span',
    {
      className: `text-xs font-medium px-2.5 py-0.5 rounded-full ${entry.bg} ${entry.text}`,
      style: { ...inlineStyle, padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 },
    },
    entry.label
  );
}
