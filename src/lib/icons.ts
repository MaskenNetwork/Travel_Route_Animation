import { TransportMode } from '@/types';

/**
 * Mappatura dei veicoli ai link SVG Repo.
 * Scarica gli SVG da SVG Repo e mettili in public/icons/
 */
export const svgRepoLinks: Record<TransportMode, string> = {
  plane: "/icons/plane.svg",
  ship: "/icons/ship.svg",
  train: "/icons/train.svg",
  bus: "/icons/bus.svg",
  camper: "/icons/camper.svg",
  car: "/icons/car.svg",
  moto: "/icons/moto.svg",
  bike: "/icons/bike.svg",
  scooter: "/icons/scooter.svg",
};

// Cache per le icone elaborate (Canvas colorati e pronti all'uso)
const externalIconCache: Map<string, HTMLCanvasElement> = new Map();
// Cache per le immagini originali per evitare ricaricamenti inutili
const originalImageCache: Map<string, HTMLImageElement> = new Map();
const imageLoadCache: Map<string, Promise<HTMLImageElement>> = new Map();

export async function preloadVehicleIcons(modes: TransportMode[], color: string) {
  const defaultModes: TransportMode[] = ['plane'];
  const uniqueModes = Array.from(new Set(modes.length > 0 ? modes : defaultModes));

  await Promise.all(uniqueModes.map(async (mode) => {
    const url = svgRepoLinks[mode] || svgRepoLinks.car;
    const img = await loadVehicleImage(url);
    createTintedIcon(mode, color, img);
  }));
}

/**
 * Recupera l'icona da SVG Repo tramite link esterno, 
 * applica il colore e restituisce un Canvas pronto per il disegno.
 */
export function getVehicleIcon(mode: TransportMode, color: string): HTMLCanvasElement | null {
  const url = svgRepoLinks[mode] || svgRepoLinks.car;
  const cacheKey = `${mode}-${color}`;

  const cached = externalIconCache.get(cacheKey);
  if (cached) return cached;

  const img = getOrCreateVehicleImage(url);

  if (img.complete && (img.naturalWidth > 0 || img.width > 0)) {
    return createTintedIcon(mode, color, img);
  }

  return null;
}

function getOrCreateVehicleImage(url: string) {
  let img = originalImageCache.get(url);
  if (!img) {
    img = new Image();
    // Ora che i file sono locali, questo non bloccherà il caricamento
    // ma permetterà al VideoExport di funzionare senza errori di sicurezza.
    img.crossOrigin = "anonymous";
    img.src = url;
    originalImageCache.set(url, img);
  }

  return img;
}

function loadVehicleImage(url: string) {
  const existing = imageLoadCache.get(url);
  if (existing) return existing;

  const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = getOrCreateVehicleImage(url);

    if (img.complete && (img.naturalWidth > 0 || img.width > 0)) {
      resolve(img);
      return;
    }

    img.addEventListener('load', () => resolve(img), { once: true });
    img.addEventListener('error', () => reject(new Error(`Unable to load vehicle icon: ${url}`)), { once: true });
  }).then(async (img) => {
    if ('decode' in img) {
      await img.decode().catch(() => undefined);
    }

    return img;
  });

  imageLoadCache.set(url, loadPromise);
  return loadPromise;
}

function createTintedIcon(mode: TransportMode, color: string, img: HTMLImageElement) {
  const cacheKey = `${mode}-${color}`;
  const cached = externalIconCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  const size = 512; // Risoluzione interna alta per evitare sgranature quando l'utente ingrandisce.
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  ctx.save();
  ctx.drawImage(img, 0, 0, size, size);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  externalIconCache.set(cacheKey, canvas);
  return canvas;
}
