export type FinanceCostArea = 'Marketplace' | 'Dostawa' | 'Operacyjne';

export type FinanceMonth = {
  month: string;
  sprzedaz: number;
  kosztTowaru: number;
  marzaNetto: number;
  marketplace: number;
  dostawa: number;
  operacyjne: number;
  kosztyRazem: number;
  marzaPct: number;
  wynikDoSprzedazy: number;
  kosztDoSprzedazy: number;
  wynikNetto: number;
};

export type FinanceChannel = { channel: string; amount: number };
export type FinanceSource = {
  name: string;
  amount: number;
  area?: FinanceCostArea;
};

export type FinanceKosztyData = {
  meta: {
    title: string;
    note: string;
    currency: string;
    sourceFile: string;
    defaultMonth: string;
  };
  months: FinanceMonth[];
  channelsByMonth: Record<string, FinanceChannel[]>;
  sourcesByMonth: Record<string, FinanceSource[]>;
};

export type FinanceChannelGroupId =
  | 'Allegro'
  | 'Sklepy własne'
  | 'Inne marketplace'
  | 'Zamówienia ręczne';

export type FinanceChannelGroup = {
  group: FinanceChannelGroupId;
  amount: number;
};
