// Loads raw scenario files through an injected reader.
// readJson(path) -> parsed object. Node passes an fs-based reader,
// the browser passes a fetch-based one. Paths are scenario-relative.

export async function loadScenario(readJson, scenarioId) {
  const base = `data/scenarios/${scenarioId}`;
  const [scenario, provinces, cities, coastline, land] = await Promise.all([
    readJson(`${base}/scenario.json`),
    readJson(`${base}/provinces.json`),
    readJson(`${base}/cities.json`),
    readJson(`${base}/coastline.json`),
    readJson(`${base}/land.json`),
  ]);
  return { scenario, provinces, cities, coastline, land };
}
