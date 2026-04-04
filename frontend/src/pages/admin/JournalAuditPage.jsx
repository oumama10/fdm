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
    <div style={{ display: 'grid', gap: 14 }}>
      <h1 style={{ margin: 0 }}>Journal d'audit</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
        <label style={labelStyle}>
          Date début
          <input type="date" style={inputStyle} value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
        </label>

        <label style={labelStyle}>
          Date fin
          <input type="date" style={inputStyle} value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
        </label>

        <label style={labelStyle}>
          Utilisateur
          <select style={inputStyle} value={filterUtilisateur} onChange={(e) => setFilterUtilisateur(e.target.value)}>
            <option value="">Tous</option>
            {users.map((user) => (
              <option key={user.id_utilisateur} value={user.id_utilisateur}>{user.nom_complet}</option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Table cible
          <select style={inputStyle} value={filterTable} onChange={(e) => setFilterTable(e.target.value)}>
            <option value="">Toutes</option>
            {tableOptions.map((table) => (
              <option key={table} value={table}>{table}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
        {journalQuery.isLoading ? (
          <div style={{ padding: 14 }}>
            <div style={{ height: 180, borderRadius: 8, background: '#f3f4f6' }} />
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={thStyle}>Date action</th>
                <th style={thStyle}>Utilisateur</th>
                <th style={thStyle}>Action</th>
                <th style={thStyle}>Table</th>
                <th style={thStyle}>IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 16, color: '#6b7280' }}>Aucun log.</td>
                </tr>
              ) : (
                rows.map((row) => {
                  const expanded = expandedRowId === row.id_log;

                  return (
                    <Fragment key={row.id_log}>
                      <tr
                        style={{ borderTop: '1px solid #f3f4f6', cursor: 'pointer' }}
                        onClick={() => setExpandedRowId(expanded ? null : row.id_log)}
                      >
                        <td style={tdStyle}>{formatDate(row.date_action)}</td>
                        <td style={tdStyle}>{row.id_utilisateur?.nom_complet || '—'}</td>
                        <td style={tdStyle}>{row.type_action || '—'}</td>
                        <td style={tdStyle}>{row.table_cible || '—'}</td>
                        <td style={tdStyle}>{row.adresse_ip || '—'}</td>
                      </tr>
                      {expanded ? (
                        <tr style={{ borderTop: '1px solid #f3f4f6' }}>
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

const labelStyle = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  color: '#374151',
};

const inputStyle = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 14,
};

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

const thStyle = { padding: 10, fontWeight: 600 };
const tdStyle = { padding: 10, verticalAlign: 'top' };
