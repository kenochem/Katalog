/** Nazwa silnika produktowego w interfejsie — jedno miejsce, żeby zmiana nazwy była jednym edytowanym plikiem. */
export const ENGINE_NAME = 'ATLAS';

/** Rozwinięcie akronimu; każda litera to jeden obszar pracy silnika. */
export const ENGINE_BACKRONYM: { letter: string; word: string; tab: string }[] = [
  { letter: 'A', word: 'Asortyment', tab: 'przypisania' },
  { letter: 'T', word: 'Taksonomia', tab: 'drzewo' },
  { letter: 'L', word: 'Lista nazw', tab: 'nazwy' },
  { letter: 'A', word: 'Atrybuty', tab: 'wiedza' },
  { letter: 'S', word: 'Standardy opisów', tab: 'opisy' },
];

export const ENGINE_TAGLINE = 'mózg katalogu Kenochem';
