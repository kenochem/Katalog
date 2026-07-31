# Snippet UI (CrmOrderView) — niepodłączony

## Import

```ts
import {
  buildWaproOrderPayload,
  getWaproOrderRequest,
  requestWaproOrder,
} from '../lib/waproOrder';
```

## State

```ts
const [sendingWapro, setSendingWapro] = useState(false);
```

## Handler (skrót)

```ts
async function sendWapro() {
  // buildWaproOrderPayload(draft, resolveSku + prices)
  // requestWaproOrder(payload) → poll getWaproOrderRequest do done/error (~120s)
}
```

## Przycisk (obok Discord, tylko cloudEnabled)

```tsx
{cloudEnabled && (
  <button
    type="button"
    onClick={() => void sendWapro()}
    disabled={!draft.items.length || sendingWapro}
    className="… bg-emerald-700 …"
    title="Tworzy ZO w WAPRO Mag (SKU = indeks katalogowy)"
  >
    {sendingWapro ? 'WAPRO…' : 'Do WAPRO'}
  </button>
)}
```

## Env (katalog-sync.env) — nie w example produkcyjnym

```env
WAPRO_ORDER_ID_FIRMY=1
WAPRO_ORDER_ID_MAGAZYNU=1
WAPRO_ORDER_ID_UZYTKOWNIKA=1
WAPRO_ORDER_ID_KONTRAHENTA=1
WAPRO_ORDER_BUFFER=1
WAPRO_ORDER_RESERVE=0
WAPRO_ORDER_BRUTTO_NETTO=Netto
```
