import { useEffect, useState } from 'react';
import { loadUserAvatar } from './userAvatar';

/** Avatar z Supabase / cache — ten sam na Talk, katalogu i hubie. */
export function useUserAvatar(userId: string | undefined | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    void loadUserAvatar(userId).then((u) => {
      if (!cancelled) setUrl(u);
    });
    const onChange = (e: Event) => {
      const id = (e as CustomEvent<{ userId?: string }>).detail?.userId;
      if (id && id !== userId) return;
      void loadUserAvatar(userId).then((u) => {
        if (!cancelled) setUrl(u);
      });
    };
    window.addEventListener('katalog-avatar-changed', onChange);
    return () => {
      cancelled = true;
      window.removeEventListener('katalog-avatar-changed', onChange);
    };
  }, [userId]);

  return url;
}
