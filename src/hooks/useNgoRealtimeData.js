import { useEffect, useMemo, useRef, useState } from 'react';
import {
  subscribeToNeeds,
  subscribeToNotifications,
  subscribeToUnreadNotificationCount,
} from '../services/firestoreRealtime';

const sameListFingerprint = (a, b) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (
      left?.id !== right?.id ||
      left?.status !== right?.status ||
      left?.read !== right?.read ||
      left?.updatedAt !== right?.updatedAt
    ) {
      return false;
    }
  }
  return true;
};

export function useNgoRealtimeData(email) {
  const [needs, setNeeds] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastNeedsRef = useRef([]);
  const lastNotificationsRef = useRef([]);

  useEffect(() => {
    if (!email) {
      setNeeds([]);
      setNotifications([]);
      setUnreadCount(0);
      return undefined;
    }

    const unsubNeeds = subscribeToNeeds(
      email,
      (items) => {
        if (sameListFingerprint(lastNeedsRef.current, items)) return;
        lastNeedsRef.current = items;
        setNeeds(items);
      },
      undefined,
      { pageSize: 250 }
    );

    const unsubNotifications = subscribeToNotifications(
      email,
      (items) => {
        if (sameListFingerprint(lastNotificationsRef.current, items)) return;
        lastNotificationsRef.current = items;
        setNotifications(items);
      },
      undefined,
      { pageSize: 100 }
    );

    const unsubUnreadCount = subscribeToUnreadNotificationCount(email, (count) => {
      setUnreadCount(count);
    });

    return () => {
      unsubNeeds();
      unsubNotifications();
      unsubUnreadCount();
    };
  }, [email]);

  return useMemo(
    () => ({
      needs,
      notifications,
      unreadCount,
    }),
    [needs, notifications, unreadCount]
  );
}
