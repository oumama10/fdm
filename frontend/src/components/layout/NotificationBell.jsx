import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getNotifications, marquerLu } from '../../api/alerts';
import { Bell } from 'lucide-react';

export default function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const containerRef = React.useRef(null);
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 30000,
    select: (res) => res.data,
  });
  const notifications = data || [];
  const unread = notifications.filter((n) => !n.lu);
  const last5 = notifications.slice(0, 5);
  const hasUnread = unread.length > 0;

  React.useEffect(() => {
    function handleOutsideClick(event) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleClick = async (notif) => {
    if (!notif?.id_notification) return;
    await marquerLu(notif.id_notification);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    // Navigate to related object if possible (customize as needed)
    if (notif.content_type && notif.object_id) {
      // Example: navigate(`/object/${notif.content_type}/${notif.object_id}`)
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          padding: 0,
          border: 'none',
          borderRadius: 10,
          background: hovered ? 'rgba(0,0,0,0.04)' : 'transparent',
          color: hovered ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)',
          cursor: 'pointer',
          transition: 'background-color 140ms ease, color 140ms ease',
        }}
        aria-label="Ouvrir les notifications"
        aria-expanded={open}
      >
        <Bell size={18} strokeWidth={1.5} />
        {hasUnread && (
          <span
            style={{
              position: 'absolute',
              top: 5,
              right: 5,
              width: 7,
              height: 7,
              borderRadius: 999,
              background: '#EF4444',
              border: '1px solid #F7F5F0',
            }}
          />
        )}
      </button>
      {open ? (
        <div style={{ position: 'absolute', right: 0, top: 36, background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, minWidth: 300, zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ padding: 12, borderBottom: '1px solid rgba(0,0,0,0.06)', fontWeight: 600, fontFamily: 'Bricolage Grotesque, sans-serif' }}>Notifications</div>
          {last5.length === 0 ? (
            <div style={{ padding: 16, color: '#888' }}>Aucune notification</div>
          ) : (
            last5.map((notif, index) => {
              const notifKey =
                notif?.id_notification ?? `${notif?.content_type || 'notif'}-${notif?.object_id || 'na'}-${index}`;

              return (
              <div key={notifKey} style={{ padding: 12, borderBottom: '1px solid #f5f5f5', cursor: 'pointer', background: notif.lu ? '#fff' : '#e1f5ee' }} onClick={() => handleClick(notif)}>
                <div style={{ fontWeight: notif.lu ? 'normal' : 'bold' }}>{notif.titre}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{notif.message}</div>
              </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
