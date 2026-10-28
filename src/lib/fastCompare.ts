/**
 * `String.prototype.localeCompare(b, 'pl', {...})` tworzy nowy Intl.Collator przy KAŻDYM wywołaniu, co przy sortowaniu
 * tysięcy produktów trwa sekundami. Podmieniamy ją na wersję z buforowanym collatorem (ten sam wynik).
 * Wywołanie bez argumentów językowych zostaje natywne (V8 ma na nie szybką ścieżkę).
 */
const collators = new Map<string, Intl.Collator>();

function collatorFor(locales: string | string[] | undefined, options: Intl.CollatorOptions | undefined): Intl.Collator {
  const key = `${Array.isArray(locales) ? locales.join(',') : (locales ?? '')}|${options?.sensitivity ?? ''}|${options?.numeric ? 1 : 0}|${options?.caseFirst ?? ''}|${options?.ignorePunctuation ? 1 : 0}|${options?.usage ?? ''}`;
  let c = collators.get(key);
  if (!c) {
    c = new Intl.Collator(locales, options);
    collators.set(key, c);
  }
  return c;
}

export function installFastLocaleCompare(): void {
  const proto = String.prototype as unknown as { localeCompare: unknown; __fastLocaleCompare?: boolean };
  if (proto.__fastLocaleCompare) return;
  const native = proto.localeCompare as (this: string, that: string) => number;
  proto.localeCompare = function (this: string, that: string, locales?: string | string[], options?: Intl.CollatorOptions): number {
    if (locales === undefined && options === undefined) return native.call(this, that);
    return collatorFor(locales, options).compare(String(this), String(that));
  };
  proto.__fastLocaleCompare = true;
}

installFastLocaleCompare();
