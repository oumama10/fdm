import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow, isToday, isYesterday, isThisWeek, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CheckCircle2, AlertCircle, InfoIcon, XCircle } from 'lucide-react';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../../api/notifications';
import PageBackButton from '../../components/ui/PageBackButton';

const levelColors = {
  info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', icon: 'text-blue-500' },
  success: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', icon: 'text-green-500' },
  warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-900', icon: 'text-yellow-500' },
  danger: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', icon: 'text-red-500' },
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

function NotificationItem({ notif, onMarkAsRead }) {
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
      className={`p-4 border-l-4 rounded cursor-pointer transition-all ${colors.bg} ${colors.border} hover:shadow-md`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-1 flex-shrink-0 ${colors.icon}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${colors.text} ${!notif.lu ? 'font-semibold' : ''}`}>
            {notif.message}
          </p>
          <p className="text-xs text-gray-500 mt-1">{relativeTime}</p>
          {notif.lien && (
            <p className="text-xs text-blue-600 mt-1">Cliquez pour voir plus</p>
          )}
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

export default function NotificationsPage() {
  const [selectedFilter, setSelectedFilter] = useState('all'); // all, unread

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications-list-page'],
    queryFn: () => getNotifications(1, 100),
    select: (res) => res.data,
  });

  let notifications = data || [];
  if (selectedFilter === 'unread') {
    notifications = notifications.filter((n) => !n.lu);
  }

  const groups = groupNotificationsByPeriod(notifications);
  const unreadCount = (data || []).filter((n) => !n.lu).length;

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <PageBackButton />
              <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={isLoading}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedFilter === 'all'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Toutes
            </button>
            <button
              onClick={() => setSelectedFilter('unread')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedFilter === 'unread'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Non lues ({unreadCount})
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="text-center text-gray-500">Chargement...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center text-gray-500">
            <p>
              {selectedFilter === 'unread'
                ? 'Aucune notification non lue'
                : 'Aucune notification'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.label}>
                <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
                  {group.label}
                </h2>
                <div className="space-y-3">
                  {group.notifications.map((notif) => (
                    <NotificationItem
                      key={notif.id_notification}
                      notif={notif}
                      onMarkAsRead={handleMarkAsRead}
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
