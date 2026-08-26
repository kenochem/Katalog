/**
 * Kompresja/skalowanie zdjecia przed wyslaniem do Storage. Telefony robia zdjecia
 * 10-50 MP (nieraz kilkanascie MB) - bez tego surowy plik szedl prosto na serwer,
 * co na slabszych telefonach potrafilo wywalic upload bledem braku pamieci.
 *
 * WAZNE: zwykle "zdekoduj pelen obraz do bitmapy, potem przeskaluj na canvasie"
 * (pierwsza wersja tego pliku) samo w sobie wymaga trzymania w pamieci calego
 * oryginalu (np. 4032x3024 = ok. 49 MB nieskompresowanych danych) - na telefonie
 * z malo RAM-u to WLASNIE ta chwila potrafi wywalic "brak pamieci", nie sam upload.
 * Dlatego najpierw probujemy tanio poznac wymiary (przez <img>, bez pelnego
 * dekodowania pikseli), a potem prosimy przegladarke o zdekodowanie OD RAZU w
 * docelowym, mniejszym rozmiarze (createImageBitmap z resizeWidth/resizeHeight) -
 * pelnorozdzielczy bitmap nigdy nie trafia do pamieci.
 */

function readImageDimensions(file: Blob): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const cleanup = () => URL.revokeObjectURL(url);
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      cleanup();
      resolve(dims.width > 0 && dims.height > 0 ? dims : null);
    };
    img.onerror = () => {
      cleanup();
      resolve(null);
    };
    img.src = url;
  });
}

async function compressViaResizedBitmap(
  file: Blob,
  maxSide: number,
  quality: number,
): Promise<Blob | null> {
  const dims = await readImageDimensions(file);
  if (!dims) return null;

  const scale = Math.min(1, maxSide / Math.max(dims.width, dims.height));
  const targetW = Math.max(1, Math.round(dims.width * scale));
  const targetH = Math.max(1, Math.round(dims.height * scale));

  let bitmap: ImageBitmap;
  try {
    // Kluczowe: podajemy juz docelowy, mniejszy rozmiar - przegladarka dekoduje
    // od razu w tej skali, nigdy nie trzymajac w pamieci pelnej rozdzielczosci.
    bitmap = await createImageBitmap(file, {
      resizeWidth: targetW,
      resizeHeight: targetH,
      resizeQuality: 'medium',
    });
  } catch {
    return null;
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
    });
  } finally {
    bitmap.close();
  }
}

async function compressViaFullDecode(
  file: Blob,
  maxSide: number,
  quality: number,
): Promise<Blob | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
    });
  } finally {
    bitmap.close();
  }
}

export async function compressImageFile(
  file: Blob,
  maxSide = 1600,
  quality = 0.85,
): Promise<Blob> {
  // Sciezka 1 (preferowana, oszczedna dla pamieci): tanio poznaj wymiary, potem
  // poproś przegladarke o dekodowanie od razu w mniejszym rozmiarze.
  const resized = await compressViaResizedBitmap(file, maxSide, quality).catch(() => null);
  if (resized && resized.size > 0 && resized.size < file.size) return resized;

  // Sciezka 2 (fallback dla starszych przegladarek bez resize przy dekodowaniu):
  // pelne dekodowanie + reczne skalowanie na canvasie - wieksze zuzycie pamieci,
  // ale nadal lepsze niz wyslanie surowego oryginalu.
  const fullDecode = await compressViaFullDecode(file, maxSide, quality).catch(() => null);
  if (fullDecode && fullDecode.size > 0 && fullDecode.size < file.size) return fullDecode;

  // Ostatnia deska ratunku: wyslij oryginal zamiast wywalac cala operacje.
  return file;
}
