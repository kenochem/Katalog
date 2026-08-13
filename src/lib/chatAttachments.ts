const VOICE_RE = /^\[\[(?:talk-voice|hub-voice):([^|\]]+)\|(\d+)\]\](?:\n([\s\S]*))?$/;
const FILE_RE = /^\[\[(?:talk-file|hub-file):([^|\]]+)\|([^|\]]+)\|(\d+)\|([^|\]]*)\]\](?:\n([\s\S]*))?$/;
const GIF_RE = /^\[\[(?:talk-gif|hub-gif):([^|\]]+)\|([^|\]]+)\]\](?:\n([\s\S]*))?$/;

export type ChatAttachmentKind = 'voice' | 'file' | 'gif';

export interface ParsedChatBody {
  attachmentUrl: string | null;
  attachmentKind: ChatAttachmentKind | null;
  voiceDurationMs?: number;
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
  gifLabel?: string;
  text: string;
}

function decodePart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function encodePart(value: string): string {
  return encodeURIComponent(value).replace(/\|/g, '%7C');
}

export function parseChatBody(body: string): ParsedChatBody {
  const voiceMatch = body.match(VOICE_RE);
  if (voiceMatch) {
    return {
      attachmentUrl: voiceMatch[1],
      attachmentKind: 'voice',
      voiceDurationMs: Number(voiceMatch[2]) || 0,
      text: (voiceMatch[3] ?? '').trim(),
    };
  }
  const fileMatch = body.match(FILE_RE);
  if (fileMatch) {
    return {
      attachmentUrl: fileMatch[1],
      attachmentKind: 'file',
      fileName: decodePart(fileMatch[2]),
      fileSize: Number(fileMatch[3]) || 0,
      fileMime: decodePart(fileMatch[4] || ''),
      text: (fileMatch[5] ?? '').trim(),
    };
  }
  const gifMatch = body.match(GIF_RE);
  if (gifMatch) {
    return {
      attachmentUrl: gifMatch[1],
      attachmentKind: 'gif',
      gifLabel: decodePart(gifMatch[2]),
      text: (gifMatch[3] ?? '').trim(),
    };
  }
  return { attachmentUrl: null, attachmentKind: null, text: body };
}

export function buildVoiceMessage(publicUrl: string, durationMs: number, caption = ''): string {
  const ms = Math.max(0, Math.round(durationMs));
  const tag = `[[talk-voice:${publicUrl}|${ms}]]`;
  const cap = caption.trim();
  return cap ? `${tag}\n${cap}` : tag;
}

export function buildFileMessage(
  publicUrl: string,
  fileName: string,
  size: number,
  mime = '',
  caption = '',
): string {
  const tag = `[[talk-file:${publicUrl}|${encodePart(fileName)}|${Math.max(0, Math.round(size))}|${encodePart(mime)}]]`;
  const cap = caption.trim();
  return cap ? `${tag}\n${cap}` : tag;
}

export function buildGifMessage(publicUrl: string, label: string, caption = ''): string {
  const tag = `[[talk-gif:${publicUrl}|${encodePart(label)}]]`;
  const cap = caption.trim();
  return cap ? `${tag}\n${cap}` : tag;
}

export function formatAttachmentSize(bytes = 0): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function attachmentPreviewLabel(kind: ChatAttachmentKind | null): string {
  if (kind === 'voice') return '🎤 Głosówka';
  if (kind === 'file') return '📎 Plik';
  if (kind === 'gif') return 'GIF';
  return 'Załącznik';
}

export function inboxBodyPreview(body: string, max = 120): string {
  const parsed = parseChatBody(body);
  if (parsed.attachmentKind === 'voice') {
    return parsed.text.trim() ? `🎤 ${parsed.text.trim()}` : '🎤 Głosówka';
  }
  if (parsed.attachmentKind === 'file') {
    const name = parsed.fileName || 'plik';
    return parsed.text.trim() ? `📎 ${parsed.text.trim()}` : `📎 ${name}`;
  }
  if (parsed.attachmentKind === 'gif') {
    return parsed.text.trim() ? `GIF: ${parsed.text.trim()}` : `GIF: ${parsed.gifLabel || 'reakcja'}`;
  }
  const oneLine = body.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}
