// Loads raw scenario files through an injected reader.
// readJson(path) -> parsed object. Node passes an fs-based reader,
// the browser passes a fetch-based one. Paths are scenario-relative.

export async function loadScenario(readJson, scenarioId) {
  const base = `data/scenarios/${scenarioId}`;
  const [scenario, provinces, cities, coastline, coastlineHd, land, landOsm, landCountries, rivers, lakes, terrain, waterways, seas] = await Promise.all([
    readJson(`${base}/scenario.json`),
    readJson(`${base}/provinces.json`),
    readJson(`${base}/cities.json`),
    readJson(`${base}/coastline.json`),
    readJson(`${base}/coastline-hd.json`),
    readJson(`${base}/land.json`),
    readJson(`${base}/land-osm.json`),
    readJson(`${base}/land-countries.json`),
    readJson(`${base}/rivers.json`),
    readJson(`${base}/lakes.json`),
    readJson(`${base}/terrain-grid.json`),
    readJson(`${base}/waterways.json`),
    readJson(`${base}/seas.json`),
  ]);
  return { scenario, provinces, cities, coastline, coastlineHd, land, landOsm, landCountries, rivers, lakes, terrain, waterways, seas };
}
