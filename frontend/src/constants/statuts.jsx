export const STAGING_ITEM_LABELS = {
  en_attente: { label: 'En attente', bg: 'bg-amber-50',  text: 'text-amber-700' },
  approuve:   { label: 'Approuvé',   bg: 'bg-green-50',  text: 'text-green-700' },
  rejete:     { label: 'Rejeté',     bg: 'bg-red-50',    text: 'text-red-700'   },
  modifie:    { label: 'Modifié',    bg: 'bg-orange-50', text: 'text-orange-600' },
};

export const IMPORT_STATUT_LABELS = {
  en_attente:   { label: 'À envoyer',    bg: 'bg-gray-50',  text: 'text-gray-600'  },
  brouillon:    { label: 'À envoyer',    bg: 'bg-gray-50',  text: 'text-gray-600'  },
  en_revision:  { label: 'En révision',  bg: 'bg-blue-50',  text: 'text-blue-700'  },
  valide:       { label: 'Validé',       bg: 'bg-green-50', text: 'text-green-700' },
  non_conforme: { label: 'Non conforme', bg: 'bg-red-50',   text: 'text-red-700'   },
  autre:        { label: 'Rejeté',       bg: 'bg-red-50',   text: 'text-red-700'   },
  rejete:       { label: 'Rejeté',       bg: 'bg-red-50',   text: 'text-red-700'   },
};

export const MARCHE_STATUT_LABELS = {
  en_attente_livraison:  { label: 'En attente de livraison', bg: 'bg-amber-50',  text: 'text-amber-700' },
  receptionne_et_stocke: { label: 'Réceptionné',             bg: 'bg-green-50',  text: 'text-green-700' },
  non_conforme:          { label: 'Non conforme',            bg: 'bg-red-50',    text: 'text-red-700'   },
  refuse:                { label: 'Refusé',                  bg: 'bg-red-50',    text: 'text-red-700'   },
};

export const TYPE_ACQUISITION_LABELS = {
  marche:       { label: 'Marché',       bg: 'bg-indigo-50', text: 'text-indigo-700' },
  bon_commande: { label: 'Bon commande', bg: 'bg-gray-100',  text: 'text-gray-600'   },
  donation:     { label: 'Don',          bg: 'bg-amber-50',  text: 'text-amber-700'  },
};

export const INSTANCE_ETAT_LABELS = {
  neuf:         { label: 'Neuf',          bg: 'bg-green-50',  text: 'text-green-700'   },
  bon_etat:     { label: 'Bon état',      bg: 'bg-green-50',  text: 'text-green-700'   },
  usage_normal: { label: 'Usage normal',  bg: 'bg-amber-50',  text: 'text-amber-700'   },
  endommage:    { label: 'Endommagé',     bg: 'bg-red-50',    text: 'text-red-700'     },
  hors_service: { label: 'Hors service',  bg: 'bg-red-50',    text: 'text-red-700'     },
  retourne:     { label: 'Retourné',      bg: 'bg-violet-50', text: 'text-violet-700'  },
};

export const MOTIFS_REJET = [
  {
    value: 'non_conforme',
    label: 'Non conforme',
    sub: 'Les données extraites ne correspondent pas au document source',
  },
  {
    value: 'document_invalide',
    label: 'Document invalide',
    sub: 'Mauvais format, document illisible ou données incomplètes',
  },
  {
    value: 'autre',
    label: 'Autre',
    sub: 'Préciser le motif dans le commentaire ci-dessous',
  },
];

export function StatusBadge({ map, value }) {
  const entry = map[value];
  if (!entry) {
    return (
      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
        {value ?? '—'}
      </span>
    );
  }
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${entry.bg} ${entry.text}`}>
      {entry.label}
    </span>
  );
}
