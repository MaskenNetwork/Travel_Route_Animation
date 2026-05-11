import * as d3 from 'd3';
import * as topojson from 'topojson-client';

let worldDataPromise: Promise<d3.GeoPermissibleObjects> | null = null;

export async function loadWorldData(signal?: AbortSignal) {
  if (!worldDataPromise) {
    worldDataPromise = fetch('/data/world-110m.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Unable to load world map data.');
        }

        return response.json();
      })
      .then((data) => topojson.feature(data, data.objects.countries) as d3.GeoPermissibleObjects)
      .catch((error) => {
        worldDataPromise = null;
        throw error;
      });
  }

  const request = worldDataPromise;

  if (!signal) return request;
  if (signal.aborted) throw createAbortError();

  return new Promise<d3.GeoPermissibleObjects>((resolve, reject) => {
    const handleAbort = () => reject(createAbortError());

    signal.addEventListener('abort', handleAbort, { once: true });
    request
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', handleAbort));
  });
}

function createAbortError() {
  return new DOMException('Aborted', 'AbortError');
}
