import { showToast } from './toast';

/** Kopiuje tekst do schowka (z zapasową metodą dla starszych przeglądarek) i pokazuje powiadomienie. */
export async function copyText(text: string, what = 'nazwę'): Promise<boolean> {
  const value = text ?? '';
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (!ok) throw new Error('copy failed');
    } catch {
      showToast('Nie udało się skopiować', 'error');
      return false;
    }
  }
  showToast(`Skopiowano ${what}`, 'ok', 1800);
  return true;
}
