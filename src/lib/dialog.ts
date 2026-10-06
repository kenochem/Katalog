/**
 * Okna dialogowe spójne z wyglądem aplikacji (zamiast systemowych confirm/prompt/alert).
 * Użycie:  if (!(await confirmDialog({ message: '…', tone: 'danger' }))) return;
 * Okno renderuje <DialogHost /> (montowany w main.tsx). Bez hosta spadamy na okna przeglądarki.
 */

export type DialogTone = 'danger' | 'warn' | 'info';

export interface DialogOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
}

export interface PromptOptions extends DialogOptions {
  defaultValue?: string;
  placeholder?: string;
}

export type DialogRequest =
  | ({ kind: 'confirm'; resolve: (v: boolean) => void } & DialogOptions)
  | ({ kind: 'alert'; resolve: () => void } & DialogOptions)
  | ({ kind: 'prompt'; resolve: (v: string | null) => void } & PromptOptions);

type Listener = (queue: DialogRequest[]) => void;

let queue: DialogRequest[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(queue);
}

export function subscribeDialogs(fn: Listener): () => void {
  listeners.add(fn);
  fn(queue);
  return () => listeners.delete(fn);
}

function enqueue(req: DialogRequest) {
  queue = [...queue, req];
  emit();
}

export function dismissDialog(req: DialogRequest) {
  queue = queue.filter((r) => r !== req);
  emit();
}

export function confirmDialog(opts: DialogOptions): Promise<boolean> {
  if (listeners.size === 0) return Promise.resolve(window.confirm(opts.message));
  return new Promise((resolve) => enqueue({ kind: 'confirm', resolve, ...opts }));
}

export function alertDialog(opts: DialogOptions): Promise<void> {
  if (listeners.size === 0) {
    window.alert(opts.message);
    return Promise.resolve();
  }
  return new Promise((resolve) => enqueue({ kind: 'alert', resolve, ...opts }));
}

export function promptDialog(opts: PromptOptions): Promise<string | null> {
  if (listeners.size === 0) return Promise.resolve(window.prompt(opts.message, opts.defaultValue ?? ''));
  return new Promise((resolve) => enqueue({ kind: 'prompt', resolve, ...opts }));
}
