import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow, isToday, isYesterday, isThisWeek, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CheckCircle2, AlertCircle, InfoIcon, XCircle } from 'lucide-react';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../../api/notifications';

const levelColors = {
  info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-500', button: 'hover:bg-blue-100' },
  success: { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-500', button: 'hover:bg-green-100' },
  warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'text-yellow-500', button: 'hover:bg-yellow-100' },
  danger: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-500', button: 'hover:bg-red-100' },
};

const levelIcons = {
  info: <InfoIcon size={20} />,
  success: <CheckCircle2 size={20} />,
  warning: <AlertCircle size={20} />,
  danger: <XCircle size={20} />,
};

function groupNotificationsByPeriod(notifications) {
  const today = [];
  const yesterday = [];
  const thisWeek = [];
  const older = [];

  notifications.forEach((notif) => {
    const date = parseISO(notif.created_at);
    if (isToday(date)) today.push(notif);
    else if (isYesterday(date)) yesterday.push(notif);
    else if (isThisWeek(date)) thisWeek.push(notif);
    else older.push(notif);
  });

  return [
    { label: 'Aujourd\'hui', notifications: today },
    { label: 'Hier', notifications: yesterday },
    { label: 'Cette semaine', notifications: thisWeek },
    { label: 'Plus ancien', notifications: older },
  ].filter((group) => group.notifications.length > 0);
}

function NotificationItem({ notif, onMarkAsRead, isLoading }) {
  const colors = levelColors[notif.niveau] || levelColors.info;
  const icon = levelIcons[notif.niveau] || levelIcons.info;
  const date = parseISO(notif.created_at);
  const relativeTime = formatDistanceToNow(date, { locale: fr, addSuffix: true });

  const handleClick = async () => {
    if (!notif.lu) {
      await onMarkAsRead(notif.id_notification);
    }
    if (notif.lien) {
      window.location.href = notif.lien;
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`p-4 border-l-4 rounded cursor-pointer transition-all ${colors.bg} ${colors.border} ${colors.button} border-l-4`}
      style={{ borderLeftColor: `var(--color-${notif.niveau})` }}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-1 flex-shrink-0 ${colors.icon}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium text-gray-900 ${!notif.lu ? 'font-semibold' : ''}`}>
            {notif.message}
          </p>
          <p className="text-xs text-gray-500 mt-1">{relativeTime}</p>
        </div>
        {!notif.lu && (
          <div className="flex-shrink-0">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function NotificationPanel() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications-list'],
    queryFn: () => getNotifications(1, 100),
    select: (res) => res.data,
  });

  const notifications = data || [];
  const groups = groupNotificationsByPeriod(notifications);
  const unreadCount = notifications.filter((n) => !n.lu).length;

  const handleMarkAsRead = async (id) => {
    await markNotificationAsRead(id);
    refetch();
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount > 0) {
      await markAllNotificationsAsRead();
      refetch();
    }
  };

  return (
    <div className="flex flex-col h-full max-w-md">
      {/* Header */}
      <div className="border-b border-gray-200 p-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            disabled={isLoading}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-sm">Aucune notification</p>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            {groups.map((group) => (
              <div key={group.label}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {group.label}
                </h3>
                <div className="space-y-2">
                  {group.notifications.map((notif) => (
                    <NotificationItem
                      key={notif.id_notification}
                      notif={notif}
                      onMarkAsRead={handleMarkAsRead}
                      isLoading={isLoading}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
