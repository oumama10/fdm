import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, CheckCheck, CheckCircle, ExternalLink, Info, Package } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../../api/notifications';

// ── Design tokens ──────────────────────────────────────────────────────────
const T = {
  blue: '#0C447C', lightBlue: '#1a7abf',
  textDark: '#0f172a', textMid: '#374151', textMuted: '#64748b',
  border: '#e2e8f0', bgWhite: '#ffffff', bgSubtle: '#f8fafc',
  radius: 12, radiusSm: 8,
};

// ── Helpers ────────────────────────────────────────────────────────────────
function timeAgo(dateString) {
  if (!dateString) return '';
  const diff = Math.floor((Date.now() - new Date(dateString)) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return 'Hier';
  if (diff < 604800) return `Il y a ${Math.floor(diff / 86400)} j`;
  return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

const NIVEAU_STYLE = {
  critique:  { bg: '#fee2e2', color: '#991b1b', Icon: AlertTriangle },
  error:     { bg: '#fee2e2', color: '#991b1b', Icon: AlertTriangle },
  warning:   { bg: '#fef3c7', color: '#92400e', Icon: AlertTriangle },
  info:      { bg: '#dbeafe', color: '#1e3a8a', Icon: Info },
  success:   { bg: '#bbf7d0', color: '#14532d', Icon: CheckCircle },
  stock_bas: { bg: '#ede9fe', color: '#5b21b6', Icon: Package },
};
const DEFAULT_NIVEAU = { bg: '#f1f5f9', color: '#475569', Icon: Bell };

function getNiveauStyle(niveau) {
  return NIVEAU_STYLE[niveau] || DEFAULT_NIVEAU;
}

function groupNotifications(notifs) {
  const now = new Date();
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today - 86400000);
  const weekStart = new Date(today - 6 * 86400000);

  const buckets = { today: [], yesterday: [], week: [], older: [] };
  notifs.forEach((n) => {
    const d   = new Date(n.dateCreation ?? n.date_creation ?? n.createdAt ?? n.created_at ?? 0);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (day >= today)     buckets.today.push(n);
    else if (day >= yesterday) buckets.yesterday.push(n);
    else if (day >= weekStart) buckets.week.push(n);
    else                  buckets.older.push(n);
  });

  return [
    { label: "Aujourd'hui",  items: buckets.today },
    { label: 'Hier',          items: buckets.yesterday },
    { label: 'Cette semaine', items: buckets.week },
    { label: 'Plus ancien',   items: buckets.older },
  ].filter((g) => g.items.length > 0);
}

// ── Component ──────────────────────────────────────────────────────────────
export default function NotificationBell() {
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();
  const wrapperRef   = useRef(null);
  const [open, setOpen]   = useState(false);
  const [limit, setLimit] = useState(10);

  // ── Poll unread count every 30 s ──────────────────────────────────────
  const { data: countData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn:  getUnreadCount,
    refetchInterval: 30000,
    select: (res) => res.data,
  });
  const unreadCount = countData?.count ?? 0;

  // ── Fetch list only when dropdown is open ─────────────────────────────
  const { data: notifData, isLoading } = useQuery({
    queryKey: ['notifications', 'list', limit],
    queryFn:  () => getNotifications(1, limit),
    enabled:  open,
    staleTime: 0,
    select: (res) => res.data,
  });

  const rawNotifs = Array.isArray(notifData)
    ? notifData
    : Array.isArray(notifData?.results)
    ? notifData.results
    : [];
  // Backend returns a plain array (no count). If we got exactly `limit` items,
  // there may be more — show the "Voir plus" button as a heuristic.
  const hasMore = rawNotifs.length >= limit;
  const grouped    = groupNotifications(rawNotifs);

  // ── Click outside → close ─────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setLimit(10);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  // ── Mutations ─────────────────────────────────────────────────────────
  const markReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onMutate: () => {
      // Optimistic: zero the badge immediately
      queryClient.setQueryData(['notifications', 'unread-count'], (old) =>
        old ? { ...old, data: { ...old.data, count: 0 } } : old
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // ── Handlers ──────────────────────────────────────────────────────────
  function handleNotifClick(notif) {
    const id = notif.id ?? notif.idNotification ?? notif.id_notification;
    const lu = notif.lu ?? notif.isRead ?? notif.is_read ?? false;
    if (!lu) markReadMutation.mutate(id);
    const lien = notif.lien ?? notif.link ?? null;
    if (lien) navigate(lien);
    setOpen(false);
    setLimit(10);
  }

  function handleSeeAll() {
    navigate('/gestionnaire/alertes');
    setOpen(false);
    setLimit(10);
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>

      {/* Bell button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title={`${unreadCount} notification${unreadCount !== 1 ? 's' : ''}`}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 44, height: 44, borderRadius: 10, position: 'relative',
          color: open ? T.blue : 'rgba(0,0,0,0.45)',
          background: open ? 'rgba(12,68,124,0.08)' : 'transparent',
          border: 'none', cursor: 'pointer', transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = 'transparent'; }}
      >
        <Bell size={22} strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            background: '#ef4444', color: '#fff',
            fontSize: 10, fontWeight: 700, lineHeight: 1,
            borderRadius: 999, minWidth: 16, height: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', border: '2px solid #F0F2F5',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
          width: 380, maxHeight: 520,
          display: 'flex', flexDirection: 'column',
          background: T.bgWhite, border: `1px solid ${T.border}`,
          borderRadius: T.radius, zIndex: 50,
          boxShadow: '0 8px 32px rgba(12,68,124,0.14)',
        }}>

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '13px 16px', flexShrink: 0,
            background: T.bgSubtle, borderBottom: `1px solid ${T.border}`,
            borderRadius: `${T.radius}px ${T.radius}px 0 0`,
          }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: T.textDark }}>
              Notifications
              {unreadCount > 0 && (
                <span style={{
                  marginLeft: 8, background: '#ef4444', color: '#fff',
                  fontSize: 11, fontWeight: 700, borderRadius: 999,
                  padding: '1px 6px',
                }}>
                  {unreadCount}
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllMutation.mutate()}
                disabled={markAllMutation.isPending}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: T.lightBlue, fontSize: 12, fontWeight: 600,
                  padding: '4px 8px', borderRadius: 6,
                  opacity: markAllMutation.isPending ? 0.5 : 1,
                }}
              >
                <CheckCheck size={13} />
                Tout marquer comme lu
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {isLoading ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
                Chargement...
              </div>
            ) : rawNotifs.length === 0 ? (
              <div style={{ padding: '36px 16px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
                <Bell size={28} color={T.textMuted} style={{ opacity: 0.3, display: 'block', margin: '0 auto 10px' }} />
                Aucune notification
              </div>
            ) : (
              <>
                {grouped.map((group) => (
                  <div key={group.label}>
                    {/* Group label */}
                    <div style={{
                      padding: '7px 16px 5px',
                      fontSize: 10, fontWeight: 700, color: T.textMuted,
                      textTransform: 'uppercase', letterSpacing: '0.07em',
                      background: T.bgSubtle, borderBottom: `1px solid ${T.border}`,
                    }}>
                      {group.label}
                    </div>

                    {/* Notifications */}
                    {group.items.map((notif) => {
                      const id      = notif.id ?? notif.idNotification ?? notif.id_notification;
                      const lu      = notif.lu ?? notif.isRead ?? notif.is_read ?? false;
                      const message = notif.message ?? notif.contenu ?? '';
                      const niveau  = notif.niveau ?? notif.type ?? 'info';
                      const date    = notif.dateCreation ?? notif.date_creation ?? notif.createdAt ?? notif.created_at;
                      const ns      = getNiveauStyle(niveau);
                      const { Icon } = ns;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => handleNotifClick(notif)}
                          style={{
                            display: 'flex', width: '100%', textAlign: 'left',
                            padding: '11px 16px', gap: 10, alignItems: 'flex-start',
                            background: lu ? T.bgWhite : '#eff6ff',
                            border: 'none', borderBottom: `1px solid ${T.border}`,
                            cursor: 'pointer', transition: 'background 0.1s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = T.bgSubtle; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = lu ? T.bgWhite : '#eff6ff'; }}
                        >
                          {/* Icon */}
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 30, height: 30, borderRadius: T.radiusSm, flexShrink: 0,
                            background: ns.bg, color: ns.color,
                          }}>
                            <Icon size={14} />
                          </span>

                          {/* Text */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 13, lineHeight: 1.45,
                              color: lu ? T.textMid : T.textDark,
                              fontWeight: lu ? 400 : 500,
                              overflow: 'hidden', textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                            }}>
                              {message}
                            </div>
                            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>
                              {timeAgo(date)}
                            </div>
                          </div>

                          {/* Unread dot */}
                          {!lu && (
                            <span style={{
                              width: 7, height: 7, borderRadius: '50%',
                              background: T.blue, flexShrink: 0, marginTop: 11,
                            }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}

                {/* Voir plus */}
                {hasMore && (
                  <button
                    type="button"
                    onClick={() => setLimit((l) => l + 10)}
                    style={{
                      display: 'block', width: '100%', padding: '10px',
                      background: 'none', border: 'none',
                      borderBottom: `1px solid ${T.border}`,
                      cursor: 'pointer', color: T.lightBlue,
                      fontSize: 13, fontWeight: 600, textAlign: 'center',
                    }}
                  >
                    Voir plus
                  </button>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{
            flexShrink: 0, padding: '10px 16px',
            borderTop: `1px solid ${T.border}`,
            background: T.bgSubtle,
            borderRadius: `0 0 ${T.radius}px ${T.radius}px`,
            display: 'flex', justifyContent: 'center',
          }}>
            <button
              type="button"
              onClick={handleSeeAll}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 5,
                color: T.blue, fontSize: 13, fontWeight: 600, padding: '4px 8px',
                borderRadius: 6,
              }}
            >
              Voir tout <ExternalLink size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
