import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getNotifications, marquerLu } from '../../api/alerts';
import { useNavigate } from 'react-router-dom';

export default function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 30000,
    select: (res) => res.data,
  });
  const notifications = data || [];
  const unread = notifications.filter((n) => !n.lu);
  const last5 = notifications.slice(0, 5);

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
        style={{ background: 'none', border: 'none', position: 'relative', cursor: 'pointer' }}
        aria-label="Ouvrir les notifications"
        aria-expanded={open}
      >
        <span role="img" aria-label="bell">🔔</span>
        {unread.length > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, background: 'red', color: 'white', borderRadius: '50%', fontSize: 12, padding: '2px 6px' }}>{unread.length}</span>
        )}
      </button>
      {open ? (
        <div style={{ position: 'absolute', right: 0, top: 28, background: '#fff', border: '1px solid #eee', borderRadius: 8, minWidth: 260, zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ padding: 8, borderBottom: '1px solid #eee', fontWeight: 'bold' }}>Notifications</div>
          {last5.length === 0 ? (
            <div style={{ padding: 16, color: '#888' }}>Aucune notification</div>
          ) : (
            last5.map((notif) => (
              <div key={notif.id_notification} style={{ padding: 12, borderBottom: '1px solid #f5f5f5', cursor: 'pointer', background: notif.lu ? '#fafafa' : '#e6f7ff' }} onClick={() => handleClick(notif)}>
                <div style={{ fontWeight: notif.lu ? 'normal' : 'bold' }}>{notif.titre}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{notif.message}</div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
