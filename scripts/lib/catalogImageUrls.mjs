/** Wspólna logika URL zdjęć katalogu: Baselinker CDN pierwsze, kenochem.com rezerwa. */

export function isBaselinkerCdnUrl(url) {
  const u = String(url || '').trim();
  if (!u.startsWith('http')) return false;
  try {
    const host = new URL(u).hostname.toLowerCase();
    return host.includes('baselinker.com') || host.includes('baselinker.net');
  } catch {
    return false;
  }
}

export function isKenochemShopUrl(url) {
  const u = String(url || '').trim();
  if (!u.startsWith('http')) return false;
  try {
    return new URL(u).hostname.toLowerCase().includes('kenochem.com');
  } catch {
    return false;
  }
}

export function isSupabaseStorageUrl(url) {
  const u = String(url || '').trim();
  return u.includes('supabase.co/storage/');
}

/** Priorytet wyświetlania — niższy = wcześniej w liście kandydatów. */
export function catalogImageHostPriority(url) {
  if (isSupabaseStorageUrl(url)) return 0;
  if (isBaselinkerCdnUrl(url)) return 1;
  if (isKenochemShopUrl(url)) return 4;
  return 2;
}

export function uniqueHttpUrls(urls) {
  const out = [];
  for (const url of urls) {
    const trimmed = String(url || '').trim();
    if (!trimmed.startsWith('http')) continue;
    const base = trimmed.split('?')[0];
    if (!out.some((u) => u.split('?')[0] === base)) out.push(trimmed);
  }
  return out;
}

/** Wybierz główne zdjęcie z rekordu BaseLinker — preferuj CDN Baselinker. */
export function pickBaselinkerPrimaryImage(bl) {
  const pool = uniqueHttpUrls([bl.primary, ...(bl.extras || [])]);
  const baselinker = pool.filter(isBaselinkerCdnUrl);
  if (baselinker.length) return baselinker[0];
  return pool.find((u) => !isKenochemShopUrl(u)) || pool[0] || '';
}

/** Posortuj kandydatów: custom na początku, potem host priority. */
export function sortCatalogImageCandidates(urls, customUrl) {
  const customBase = String(customUrl || '').trim().split('?')[0];
  const custom = customBase ? urls.filter((u) => u.split('?')[0] === customBase) : [];
  const rest = urls
    .filter((u) => !customBase || u.split('?')[0] !== customBase)
    .sort((a, b) => catalogImageHostPriority(a) - catalogImageHostPriority(b));
  return [...custom, ...rest];
}
