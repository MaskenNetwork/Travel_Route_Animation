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

/**
 * Recupera l'icona da SVG Repo tramite link esterno, 
 * applica il colore e restituisce un Canvas pronto per il disegno.
 */
export function getVehicleIcon(mode: TransportMode, color: string): HTMLCanvasElement | null {
  const url = svgRepoLinks[mode] || svgRepoLinks.car;
  const cacheKey = `${mode}-${color}`;

  const cached = externalIconCache.get(cacheKey);
  if (cached) return cached;

  let img = originalImageCache.get(url);
  if (!img) {
    img = new Image();
    // Ora che i file sono locali, questo non bloccherà il caricamento
    // ma permetterà al VideoExport di funzionare senza errori di sicurezza.
    img.crossOrigin = "anonymous";
    img.src = url;
    originalImageCache.set(url, img);
  }

  if (img.complete && (img.naturalWidth > 0 || img.width > 0)) {
    const canvas = document.createElement('canvas');
    const size = 512; // Risoluzione interna alta per evitare sgranature quando l'utente ingrandisce.
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.save();

      // Disegniamo l'icona originale
      ctx.drawImage(img, 0, 0, size, size);
      
      // Applichiamo il Colore (Tinting)
      // source-in mantiene la forma dell'icona e la riempie con il fillStyle
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, size, size);
      
      ctx.restore();
      
      externalIconCache.set(cacheKey, canvas);
      return canvas;
    }
  }

  return null;
}
