import React from 'react';
import { Badge } from './ui/badge';

const statusMap = {
  en_stock: { label: 'En stock', color: '#166534', bg: '#dcfce7', border: '#bbf7d0' },
  en_service: { label: 'Affecté', color: '#1d4ed8', bg: '#dbeafe', border: '#bfdbfe' },
  en_reparation: { label: 'En réparation', color: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  rebute: { label: 'Rebuté', color: '#991b1b', bg: '#fee2e2', border: '#fecaca' },
  en_cours: { label: 'En cours', color: '#1d4ed8', bg: '#dbeafe', border: '#bfdbfe' },
  traite: { label: 'Traité', color: '#166534', bg: '#dcfce7', border: '#bbf7d0' },
  en_instance: { label: 'En instance', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  refuse: { label: 'Refusé', color: '#991b1b', bg: '#fee2e2', border: '#fecaca' },
  validee: { label: 'Validée', color: '#166534', bg: '#dcfce7', border: '#bbf7d0' },
  refusee: { label: 'Refusée', color: '#991b1b', bg: '#fee2e2', border: '#fecaca' },
  en_preparation: { label: 'En préparation', color: '#1d4ed8', bg: '#dbeafe', border: '#bfdbfe' },
  complete_avec_decharge: { label: 'Complète', color: '#166534', bg: '#dcfce7', border: '#bbf7d0' },
  brouillon: { label: 'Brouillon', color: '#374151', bg: '#f3f4f6', border: '#e5e7eb' },
  en_revision: { label: 'En révision', color: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  valide: { label: 'Validé', color: '#166534', bg: '#dcfce7', border: '#bbf7d0' },
  rejete: { label: 'Rejeté', color: '#991b1b', bg: '#fee2e2', border: '#fecaca' },
  en_attente: { label: 'En attente', color: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  signe: { label: 'Signé', color: '#1d4ed8', bg: '#dbeafe', border: '#bfdbfe' },
  en_attente_livraison: { label: 'En attente livraison', color: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  receptionne_et_stocke: { label: 'Réceptionné', color: '#166534', bg: '#dcfce7', border: '#bbf7d0' },
  non_conforme: { label: 'Non conforme', color: '#991b1b', bg: '#fee2e2', border: '#fecaca' },
  bon: { label: 'Bon', color: '#166534', bg: '#dcfce7', border: '#bbf7d0' },
  moyen: { label: 'Moyen', color: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  mauvais: { label: 'Mauvais', color: '#991b1b', bg: '#fee2e2', border: '#fecaca' },
  retourne: { label: 'Retourné', color: '#6d28d9', bg: '#ede9fe', border: '#ddd6fe' },
};

export function StatusBadge({ status }) {
  const config = statusMap[status] || {
    label: status ? String(status).replaceAll('_', ' ') : '—',
    color: '#374151',
    bg: '#f3f4f6',
    border: '#e5e7eb',
  };

  return (
    <Badge
      style={{
        color: config.color,
        background: config.bg,
        borderColor: config.border,
        textTransform: 'capitalize',
      }}
    >
      {config.label}
    </Badge>
  );
}
