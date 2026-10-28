/**
 * Czy to urządzenie mobilne (telefon / tablet)? Używane, żeby pokazywać „Aparat” tylko tam, gdzie ma sens.
 * Laptopy z ekranem dotykowym (Windows) zostają „komputerem”; iPadOS podaje się jako Mac, więc sprawdzamy dotyk.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPod|iPad|Mobile|Windows Phone/i.test(ua)) return true;
  return /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;
}
