import { useEffect, useMemo, useState } from 'react';

const KEY_PREFIX = 'resqai_offline';

const safeJsonParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

export function useOfflineSync({ ngoEmail, needs = [], onReconnectSync }) {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    if (!ngoEmail) return;
    const cacheKey = `${KEY_PREFIX}_${ngoEmail}_snapshot`;
    const snapshot = {
      cachedAt: Date.now(),
      needs: Array.isArray(needs) ? needs.slice(0, 200) : [],
    };
    localStorage.setItem(cacheKey, JSON.stringify(snapshot));
  }, [ngoEmail, needs]);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      if (!ngoEmail) return;
      const queueKey = `${KEY_PREFIX}_${ngoEmail}_queue`;
      const queue = safeJsonParse(localStorage.getItem(queueKey), []);
      if (queue.length) {
        try {
          await onReconnectSync?.(queue);
        } finally {
          localStorage.removeItem(queueKey);
        }
      } else {
        await onReconnectSync?.([]);
      }
    };

    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [ngoEmail, onReconnectSync]);

  const queueOfflineAction = (action) => {
    if (!ngoEmail) return;
    const queueKey = `${KEY_PREFIX}_${ngoEmail}_queue`;
    const queue = safeJsonParse(localStorage.getItem(queueKey), []);
    queue.push({ ...action, queuedAt: Date.now() });
    localStorage.setItem(queueKey, JSON.stringify(queue));
  };

  const cachedNeeds = useMemo(() => {
    if (!ngoEmail) return [];
    const cacheKey = `${KEY_PREFIX}_${ngoEmail}_snapshot`;
    return safeJsonParse(localStorage.getItem(cacheKey), { needs: [] }).needs || [];
  }, [ngoEmail]);

  return {
    isOnline,
    cachedNeeds,
    queueOfflineAction,
  };
}
