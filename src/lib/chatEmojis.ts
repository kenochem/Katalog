export interface ChatEmojiGroup {
  id: string;
  label: string;
  emojis: string[];
}

export const CHAT_EMOJI_GROUPS: ChatEmojiGroup[] = [
  {
    id: 'smile',
    label: 'Buźki',
    emojis: [
      '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '🙂', '😉',
      '😍', '🥰', '😘', '😋', '😎', '🤔', '😐', '😑', '🙄', '😏',
      '😣', '😥', '😮', '😯', '😲', '😳', '🥺', '😢', '😭', '😤',
      '😡', '🤯', '😱', '😴', '🤢', '🤮', '🤧', '🥳', '😇', '🤠',
    ],
  },
  {
    id: 'gesture',
    label: 'Gesty',
    emojis: [
      '👍', '👎', '👌', '✌️', '🤞', '🤝', '🙏', '👏', '🙌', '💪',
      '🤙', '👋', '🤘', '🖐️', '✋', '👊', '🤛', '🤜', '☝️', '👆',
    ],
  },
  {
    id: 'heart',
    label: 'Serca',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '❣️', '💕', '💖', '💗', '💓', '💞', '💘'],
  },
  {
    id: 'work',
    label: 'Praca',
    emojis: [
      '☕', '🍕', '🍺', '🎉', '🔥', '⭐', '✅', '❌', '⚠️', '💡',
      '📦', '🛠️', '📞', '📧', '📅', '🕐', '🚗', '🏭', '📊', '💼',
    ],
  },
];

export function insertEmojiInText(
  current: string,
  emoji: string,
  selectionStart: number,
  selectionEnd: number,
): { next: string; cursor: number } {
  const next = current.slice(0, selectionStart) + emoji + current.slice(selectionEnd);
  const cursor = selectionStart + emoji.length;
  return { next, cursor };
}
