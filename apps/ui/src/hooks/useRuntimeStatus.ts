import { useState, useEffect, useCallback } from 'react';
import { RuntimeStatus } from '../types';
import { AppState } from '../types/state';

export function useRuntimeStatus() {
  const [appState, setAppState] = useState<AppState>('AppBoot');
  // Keep legacy status for compatibility until full migration, or map it
  const [legacyStatus, setLegacyStatus] = useState<RuntimeStatus>('loading');

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/v1/models');
      if (res.ok) {
        setAppState('Ready');
        setLegacyStatus('ready');
      } else {
        setAppState('AppOffline');
        setLegacyStatus('offline');
      }
    } catch (e) {
      setAppState('AppOffline');
      setLegacyStatus('offline');
    }
  }, []);

  useEffect(() => {
    // Initial check (AppBoot entry)
    checkStatus();

    // Polling is still good for detecting runtime death, but maybe less aggressive?
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  return { appState, status: legacyStatus, retry: checkStatus };
}
