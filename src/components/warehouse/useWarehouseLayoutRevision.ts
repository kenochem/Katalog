import { useEffect, useState } from 'react';

/** Odśwież presety / podgląd planu po zapisie layoutu (localStorage). */
export function useWarehouseLayoutRevision(): number {
  const [rev, setRev] = useState(0);
  useEffect(() => {
    function bump() {
      setRev((n) => n + 1);
    }
    window.addEventListener('katalog-wh-layout-changed', bump);
    return () => window.removeEventListener('katalog-wh-layout-changed', bump);
  }, []);
  return rev;
}
