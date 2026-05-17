import { apiClient } from './axios';

/**
 * Get paginated list of notifications for the current user
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 10)
 * @returns {Promise}
 */
export const getNotifications = (page = 1, limit = 10) => {
  return apiClient.get(`/alerts/notifications/`, {
    params: { page, limit }
  });
};

/**
 * Get count of unread notifications
 * @returns {Promise<{count: number}>}
 */
export const getUnreadCount = () => {
  return apiClient.get(`/alerts/notifications/unread-count/`);
};

/**
 * Mark a single notification as read
 * @param {number} id - Notification ID
 * @returns {Promise}
 */
export const markNotificationAsRead = (id) => {
  return apiClient.patch(`/alerts/notifications/${id}/lu/`);
};

/**
 * Mark all notifications as read
 * @returns {Promise}
 */
export const markAllNotificationsAsRead = () => {
  return apiClient.patch(`/alerts/notifications/mark-all-lu/`);
};
