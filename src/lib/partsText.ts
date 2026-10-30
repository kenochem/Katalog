/** Małe litery bez polskich znaków diakrytycznych — wspólna normalizacja nazw do dopasowywania reguł. */
export function fold(s: string): string {
  return s
    // znaki sterujące i niewidoczne (np. U+0081 po imporcie z WAPRO) zamieniamy na spację, żeby nie rozbijały słów
    .replace(/[\u0000-\u001f\u007f-\u009f ​-‍﻿]/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'l')
    .toLowerCase();
}
