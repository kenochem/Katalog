/** Bezpieczny podgląd treści HTML z poczty (sandbox, bez skryptów). */

import { useEffect, useRef } from 'react';

interface CrmMailMessageBodyProps {
  body?: string;
  bodyHtml?: string;
}

function wrapEmailDocument(inner: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank" rel="noopener"><style>
    html, body { margin: 0; padding: 0; }
    body { font-family: system-ui, Segoe UI, sans-serif; font-size: 14px; line-height: 1.5;
      padding: 12px; background: #fff; color: #1e293b; word-wrap: break-word; }
    a { color: #0284c7; }
    img { max-width: 100%; height: auto; }
    table { max-width: 100%; }
  </style></head><body>${inner}</body></html>`;
}

function fitIframeToContent(iframe: HTMLIFrameElement) {
  try {
    const doc = iframe.contentDocument;
    if (!doc?.body) return;
    const contentH = Math.max(
      doc.body.scrollHeight,
      doc.documentElement?.scrollHeight ?? 0,
    );
    const minH = 480;
    const maxH = Math.round(window.innerHeight * 0.78);
    iframe.style.height = `${Math.min(Math.max(contentH + 20, minH), maxH)}px`;
  } catch {
    iframe.style.height = '420px';
  }
}

export function formatPlainMailBody(text: string): string {
  let t = text.replace(/\r\n/g, '\n');
  t = t.replace(/\[https?:\/\/[^\]]+\]/gi, '[link]');
  t = t.replace(/https?:\/\/[^\s\]]{60,}/gi, (url) => `${url.slice(0, 42)}…`);
  return t;
}

export function CrmMailMessageBody({ body, bodyHtml }: CrmMailMessageBodyProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const html = bodyHtml?.trim();

  useEffect(() => {
    const el = iframeRef.current;
    if (!el || !html) return;
    const onLoad = () => fitIframeToContent(el);
    el.addEventListener('load', onLoad);
    return () => el.removeEventListener('load', onLoad);
  }, [html]);

  if (html) {
    return (
      <iframe
        ref={iframeRef}
        sandbox=""
        title="Treść wiadomości e-mail"
        className="min-h-[480px] w-full rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-100"
        srcDoc={wrapEmailDocument(html)}
      />
    );
  }
  const plain = body?.trim();
  if (!plain) return null;
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {formatPlainMailBody(plain)}
    </p>
  );
}
