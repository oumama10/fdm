import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bell, CheckCheck, CheckCircle, Info, Package } from 'lucide-react';

import { acquitterAlerte, getAlertes } from '../../api/alerts';
import { getStockAlertes } from '../../api/resources';
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../../api/notifications';

// ── Design tokens ──────────────────────────────────────────────────────────
const T = {
  blue: '#0C447C', lightBlue: '#1a7abf', green: '#16a34a', red: '#dc2626',
  textDark: '#0f172a', textMid: '#374151', textMuted: '#64748b',
  border: '#e2e8f0', bgWhite: '#ffffff', bgSubtle: '#f8fafc',
  radius: 12, radiusSm: 8,
};

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function timeAgo(dateString) {
  if (!dateString) return '';
  const diff = Math.floor((Date.now() - new Date(dateString)) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return 'Hier';
  if (diff < 604800) return `Il y a ${Math.floor(diff / 86400)} j`;
  return fmtDate(dateString);
}

const NIVEAU_STYLE = {
  critique:  { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', Icon: AlertTriangle },
  error:     { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', Icon: AlertTriangle },
  warning:   { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', Icon: AlertTriangle },
  info:      { bg: '#dbeafe', color: '#1e3a8a', border: '#93c5fd', Icon: Info },
  success:   { bg: '#bbf7d0', color: '#14532d', border: '#86efac', Icon: CheckCircle },
  stock_bas: { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd', Icon: Package },
};
const DEFAULT_NIVEAU = { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', Icon: Bell };

function getNiveauStyle(niveau) {
  return NIVEAU_STYLE[niveau] || DEFAULT_NIVEAU;
}

function getDaysRemaining(row) {
  if (typeof row.jours_restants === 'number') return row.jours_restants;
  if (typeof row.joursRestants === 'number') return row.joursRestants;
  return null;
}

function getAlerteId(row) { return row.id_alerte ?? row.idAlerte; }
function getNiveau(row)   { return row.niveau_alerte ?? row.niveauAlerte ?? '—'; }

// ── Notifications section ──────────────────────────────────────────────────
function NotificationsSection() {
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState(20);

  const notifQuery = useQuery({
    queryKey: ['notifications', 'list', limit],
    queryFn: () => getNotifications(1, limit),
    staleTime: 0,
    select: (res) => res.data,
  });

  const rawNotifs = Array.isArray(notifQuery.data)
    ? notifQuery.data
    : Array.isArray(notifQuery.data?.results)
    ? notifQuery.data.results
    : [];
  // Backend returns a plain array with no count — use length as heuristic.
  const hasMore = rawNotifs.length >= limit;

  const markReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onMutate: () => {
      queryClient.setQueryData(['notifications', 'unread-count'], (old) =>
        old ? { ...old, data: { ...old.data, count: 0 } } : old
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unreadCount = useMemo(() => rawNotifs.filter((n) => !(n.lu ?? n.isRead ?? n.is_read)).length, [rawNotifs]);

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={sectionTitle}>
          Historique des notifications
          {unreadCount > 0 && (
            <span style={{
              marginLeft: 8, background: '#ef4444', color: '#fff',
              fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 7px',
            }}>
              {unreadCount} non lues
            </span>
          )}
        </h3>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'none', border: `1px solid ${T.border}`,
              borderRadius: T.radiusSm, cursor: 'pointer',
              color: T.lightBlue, fontSize: 12, fontWeight: 600, padding: '5px 10px',
              opacity: markAllMutation.isPending ? 0.5 : 1,
            }}
          >
            <CheckCheck size={13} />
            Tout marquer comme lu
          </button>
        )}
      </div>

      {notifQuery.isLoading ? (
        <div style={{ height: 120, borderRadius: T.radiusSm, background: T.bgSubtle }} />
      ) : rawNotifs.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
          <Bell size={28} color={T.textMuted} style={{ opacity: 0.3, display: 'block', margin: '0 auto 10px' }} />
          Aucune notification
        </div>
      ) : (
        <>
          <div style={{ border: `1px solid ${T.border}`, borderRadius: T.radiusSm, overflow: 'hidden' }}>
            {rawNotifs.map((notif, i) => {
              const id      = notif.id ?? notif.idNotification ?? notif.id_notification;
              const lu      = notif.lu ?? notif.isRead ?? notif.is_read ?? false;
              const message = notif.message ?? notif.contenu ?? '';
              const niveau  = notif.niveau ?? notif.type ?? 'info';
              const date    = notif.dateCreation ?? notif.date_creation ?? notif.createdAt ?? notif.created_at;
              const ns      = getNiveauStyle(niveau);
              const { Icon } = ns;
              return (
                <div
                  key={id ?? i}
                  style={{
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    padding: '12px 14px',
                    background: lu ? T.bgWhite : '#eff6ff',
                    borderTop: i === 0 ? 'none' : `1px solid ${T.border}`,
                  }}
                >
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32, borderRadius: T.radiusSm, flexShrink: 0,
                    background: ns.bg, color: ns.color, border: `1px solid ${ns.border}`,
                  }}>
                    <Icon size={14} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, lineHeight: 1.5,
                      color: lu ? T.textMid : T.textDark,
                      fontWeight: lu ? 400 : 500,
                    }}>
                      {message}
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>
                      {timeAgo(date)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {!lu && (
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: T.blue, flexShrink: 0,
                      }} />
                    )}
                    {!lu && (
                      <button
                        type="button"
                        onClick={() => markReadMutation.mutate(id)}
                        disabled={markReadMutation.isPending}
                        style={{
                          fontSize: 11, color: T.textMuted, background: 'none',
                          border: `1px solid ${T.border}`, borderRadius: 6,
                          padding: '3px 8px', cursor: 'pointer',
                        }}
                      >
                        Lu
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <div style={{ marginTop: 10, textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setLimit((l) => l + 20)}
                style={{
                  background: 'none', border: `1px solid ${T.border}`,
                  borderRadius: T.radiusSm, padding: '7px 16px',
                  color: T.lightBlue, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Voir plus
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function AlertesPage() {
  const queryClient = useQueryClient();

  const alertesQuery = useQuery({
    queryKey: ['gestionnaire', 'alertes-delai'],
    queryFn: () => getAlertes(),
    staleTime: 0,
  });

  const stockQuery = useQuery({
    queryKey: ['gestionnaire', 'alertes-stock-bas'],
    queryFn: () => getStockAlertes(),
    staleTime: 0,
  });

  const acquitterMutation = useMutation({
    mutationFn: (id) => acquitterAlerte(id, { acquitte: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gestionnaire', 'alertes-delai'] }),
  });

  const alertesRows = useMemo(() => alertesQuery.data?.data || [], [alertesQuery.data?.data]);
  const stockRows   = useMemo(() => stockQuery.data?.data || [], [stockQuery.data?.data]);

  return (
    <div style={{ display: 'grid', gap: 16, paddingBottom: 40 }}>

      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.blue }}>Alertes</h1>

      {/* ── Notifications history ── */}
      <NotificationsSection />

      {/* ── Alertes délai marchés ── */}
      <div style={card}>
        <h3 style={{ ...sectionTitle, marginBottom: 14 }}>Alertes délai marchés</h3>
        {alertesQuery.isLoading ? (
          <div style={{ height: 120, borderRadius: T.radiusSm, background: T.bgSubtle }} />
        ) : (
          <div style={{ overflowX: 'auto', border: `1px solid ${T.border}`, borderRadius: T.radiusSm }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Référence', 'Type', 'Fournisseur', 'Échéance', 'Jours restants', 'Niveau', 'Acquitté'].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alertesRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '16px 12px', color: T.textMuted }}>
                      Aucune alerte délai.
                    </td>
                  </tr>
                ) : alertesRows.map((row) => {
                  const jours = getDaysRemaining(row);
                  const rowBg = typeof jours === 'number' && jours <= 7 ? '#fff5f5'
                    : typeof jours === 'number' && jours <= 14 ? '#fffbeb' : '';
                  const idAlerte = getAlerteId(row);
                  return (
                    <tr key={idAlerte} style={{ borderTop: `1px solid ${T.border}`, background: rowBg }}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: T.textDark }}>
                        {row.marche?.reference || row.idMarche?.reference || '—'}
                      </td>
                      <td style={{ ...tdStyle, color: T.textMid }}>
                        {row.marche?.type_acquisition || row.marche?.typeAcquisition || '—'}
                      </td>
                      <td style={{ ...tdStyle, color: T.textMid }}>
                        {row.fournisseur || row.nomFournisseur || '—'}
                      </td>
                      <td style={{ ...tdStyle, color: T.textMid }}>
                        {fmtDate(row.date_echeance ?? row.dateEcheance)}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: jours != null && jours <= 7 ? T.red : T.textDark }}>
                        {jours ?? '—'}
                      </td>
                      <td style={tdStyle}>
                        <NiveauBadge niveau={getNiveau(row)} />
                      </td>
                      <td style={tdStyle}>
                        {row.acquitte ? (
                          <span style={{ color: T.green, fontWeight: 600, fontSize: 12 }}>✓ Acquitté</span>
                        ) : (
                          <button
                            style={btnAcquitter}
                            onClick={() => acquitterMutation.mutate(idAlerte)}
                            disabled={acquitterMutation.isPending}
                          >
                            Acquitter
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Alertes stock bas ── */}
      <div style={card}>
        <h3 style={{ ...sectionTitle, marginBottom: 14 }}>Alertes stock bas</h3>
        {stockQuery.isLoading ? (
          <div style={{ height: 120, borderRadius: T.radiusSm, background: T.bgSubtle }} />
        ) : (
          <div style={{ overflowX: 'auto', border: `1px solid ${T.border}`, borderRadius: T.radiusSm }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Désignation', 'Catégorie', 'Qté disponible', 'Seuil', 'Statut'].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stockRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '16px 12px', color: T.textMuted }}>
                      Aucun stock bas.
                    </td>
                  </tr>
                ) : stockRows.map((row) => {
                  const low = Number(row.quantite_disponible || 0) <= Number(row.seuil_alerte || 0);
                  return (
                    <tr key={row.id_stock} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: T.textDark }}>
                        {row.id_ressource?.designation || '—'}
                      </td>
                      <td style={{ ...tdStyle, color: T.textMid }}>
                        {row.id_ressource?.id_categorie?.nom_categorie || '—'}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: low ? T.red : T.textDark }}>
                        {row.quantite_disponible ?? '—'}
                      </td>
                      <td style={{ ...tdStyle, color: T.textMid }}>{row.seuil_alerte ?? '—'}</td>
                      <td style={tdStyle}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center',
                          padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                          background: low ? '#fee2e2' : '#bbf7d0',
                          color: low ? '#991b1b' : '#14532d',
                          border: `1px solid ${low ? '#fca5a5' : '#86efac'}`,
                        }}>
                          {low ? 'Stock bas' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function NiveauBadge({ niveau }) {
  const ns = getNiveauStyle(String(niveau).toLowerCase());
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: ns.bg, color: ns.color, border: `1px solid ${ns.border}`,
    }}>
      {niveau}
    </span>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const card         = { background: T.bgWhite, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '20px 24px' };
const sectionTitle = { margin: 0, fontSize: 15, fontWeight: 600, color: T.textDark };
const thStyle      = { padding: '9px 12px', fontSize: 12, fontWeight: 700, color: T.textMuted, textAlign: 'left', borderBottom: `1px solid ${T.border}`, background: T.bgSubtle };
const tdStyle      = { padding: '10px 12px', fontSize: 13, color: T.textMid, verticalAlign: 'middle' };
const btnAcquitter = { border: 'none', borderRadius: T.radiusSm, padding: '5px 12px', background: T.blue, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 };
