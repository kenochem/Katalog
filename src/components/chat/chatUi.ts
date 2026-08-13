export function formatChatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleString('pl-PL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function chatBodySnippet(body: string, max = 120): string {
  const oneLine = body.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

const DAY_FMT = new Intl.DateTimeFormat('pl-PL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export function chatDayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startToday.getTime() - startMsg.getTime()) / 86400000);
  if (diffDays === 0) return 'Dziś';
  if (diffDays === 1) return 'Wczoraj';
  return DAY_FMT.format(d);
}

export function chatMessagesGrouped(
  a: { userId: string; createdAt: string } | undefined,
  b: { userId: string; createdAt: string } | undefined,
): boolean {
  if (!a || !b) return false;
  if (a.userId !== b.userId) return false;
  return Math.abs(new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) < 4 * 60_000;
}
