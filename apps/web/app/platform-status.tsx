'use client';
import { useEffect, useState } from 'react';
import { createApiClient } from '@events-circle/api-client';
export function PlatformStatus() {
  const [status, setStatus] = useState('Checking platform connection…');
  useEffect(() => {
    const controller = new AbortController();
    const client = createApiClient(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');
    void client
      .GET('/api/v1/core/health', { signal: controller.signal })
      .then(({ data }) => setStatus(data?.status === 'ok' ? 'Platform connected' : 'Platform unavailable'))
      .catch(() => {
        if (!controller.signal.aborted) setStatus('Platform unavailable');
      });
    return () => controller.abort();
  }, []);
  return <p role="status">{status}</p>;
}
