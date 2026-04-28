import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getJournalAudit, getUtilisateurs } from '../../api/users';

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('fr-FR');
}

function JsonDiffBlock({ oldValue, newValue }) {
  const oldParsed = parseJson(oldValue);
  const newParsed = parseJson(newValue);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Ancienne valeur</div>
        <pre style={preStyle}>{typeof oldParsed === 'string' ? oldParsed : JSON.stringify(oldParsed, null, 2)}</pre>
      </div>
      <div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Nouvelle valeur</div>
        <pre style={preStyle}>{typeof newParsed === 'string' ? newParsed : JSON.stringify(newParsed, null, 2)}</pre>
      </div>
    </div>
  );
}

export default function JournalAuditPage() {
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterUtilisateur, setFilterUtilisateur] = useState('');
  const [filterTable, setFilterTable] = useState('');

  const usersQuery = useQuery({
    queryKey: ['users', 'utilisateurs', 'audit-selector'],
    queryFn: () => getUtilisateurs(),
    staleTime: 60000,
  });

  const journalQuery = useQuery({
    queryKey: ['users', 'audit', filterDateFrom, filterDateTo, filterUtilisateur, filterTable],
    queryFn: () =>
      getJournalAudit({
        ...(filterDateFrom ? { date_from: filterDateFrom } : {}),
        ...(filterDateTo ? { date_to: filterDateTo } : {}),
        ...(filterUtilisateur ? { id_utilisateur: filterUtilisateur } : {}),
        ...(filterTable ? { table_cible: filterTable } : {}),
      }),
    staleTime: 10000,
  });

  const rows = journalQuery.data?.data || [];
  const users = usersQuery.data?.data || [];

  const tableOptions = useMemo(() => {
    const set = new Set(rows.map((row) => row.table_cible).filter(Boolean));
    return Array.from(set);
  }, [rows]);

  return (
    <div className="page-stack">
      <h1 className="page-title">Journal d'audit</h1>

      <div className="section-shell">
        <div className="grid-split" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
        <label className="field-label" style={{ display: 'grid', gap: 6 }}>
          Date début
          <input type="date" name="filter-date-from" className="field-input" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
        </label>

        <label className="field-label" style={{ display: 'grid', gap: 6 }}>
          Date fin
          <input type="date" name="filter-date-to" className="field-input" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
        </label>

        <label className="field-label" style={{ display: 'grid', gap: 6 }}>
          Utilisateur
          <select className="field-input" value={filterUtilisateur} onChange={(e) => setFilterUtilisateur(e.target.value)}>
            <option value="">Tous</option>
            {users.map((user) => (
              <option key={user.id_utilisateur} value={user.id_utilisateur}>{user.nom_complet}</option>
            ))}
          </select>
        </label>

        <label className="field-label" style={{ display: 'grid', gap: 6 }}>
          Table cible
          <select className="field-input" value={filterTable} onChange={(e) => setFilterTable(e.target.value)}>
            <option value="">Toutes</option>
            {tableOptions.map((table) => (
              <option key={table} value={table}>{table}</option>
            ))}
          </select>
        </label>
        </div>
      </div>

      <div className="data-table-wrap">
        {journalQuery.isLoading ? (
          <div style={{ padding: 14 }}>
            <div style={{ height: 180, borderRadius: 8, background: '#f3f4f6' }} />
          </div>
        ) : (
          <table className="data-table" style={{ fontSize: 14 }}>
            <thead>
              <tr>
                <th>Date action</th>
                <th>Utilisateur</th>
                <th>Action</th>
                <th>Table</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-state">Aucun log.</td>
                </tr>
              ) : (
                rows.map((row) => {
                  const expanded = expandedRowId === row.id_log;

                  return (
                    <Fragment key={row.id_log}>
                      <tr
                        style={{ cursor: 'pointer' }}
                        onClick={() => setExpandedRowId(expanded ? null : row.id_log)}
                      >
                        <td>{formatDate(row.date_action)}</td>
                        <td>{row.id_utilisateur?.nom_complet || '—'}</td>
                        <td>{row.type_action || '—'}</td>
                        <td>{row.table_cible || '—'}</td>
                        <td>{row.adresse_ip || '—'}</td>
                      </tr>
                      {expanded ? (
                        <tr>
                          <td colSpan={5} style={{ padding: 12, background: '#fafafa' }}>
                            <JsonDiffBlock oldValue={row.ancienne_valeur} newValue={row.nouvelle_valeur} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const preStyle = {
  margin: 0,
  padding: 8,
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  fontSize: 12,
  maxHeight: 220,
  overflow: 'auto',
};
