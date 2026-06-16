import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Bell, CheckCircle, Clock, XCircle } from 'lucide-react';
import { notificationApi } from '../api';
import { Notification } from '../types';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const margin = 16;
      const width = Math.min(320, window.innerWidth - margin * 2);
      const left = Math.min(
        Math.max(rect.right - width, margin),
        window.innerWidth - width - margin
      );

      setDropdownStyle({
        left,
        top: rect.bottom + 8,
        width
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        notificationApi.getAll(),
        notificationApi.getUnreadCount()
      ]);
      setNotifications(listRes.data);
      setUnreadCount(countRes.data.count);
    } catch (err) {
      console.error(err);
    }
  };

  const markRead = async (notification: Notification) => {
    if (!notification.isRead) {
      await notificationApi.markRead(notification.id);
      loadNotifications();
    }
  };

  const markAllRead = async () => {
    await notificationApi.markAllRead();
    loadNotifications();
  };

  const getIcon = (type: string) => {
    if (type === 'APPROVED') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (type === 'REJECTED') return <XCircle className="h-4 w-4 text-red-500" />;
    return <Clock className="h-4 w-4 text-blue-500" />;
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="fixed z-50 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
          style={dropdownStyle}
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                No notifications yet
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => markRead(notification)}
                  className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-gray-50 ${notification.isRead ? 'bg-white' : 'bg-blue-50'}`}
                >
                  <div className="mt-0.5 shrink-0">{getIcon(notification.type)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900">{notification.message}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!notification.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
