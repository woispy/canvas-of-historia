// Computed, side-effect-free world queries. UI and systems read through these.

export function getState(world, stateId) {
  return world.states.get(stateId);
}

export function getProvince(world, provinceId) {
  return world.provinces.get(provinceId);
}

export function getCity(world, cityId) {
  return world.cities.get(cityId);
}

export function provincesOfState(world, stateId) {
  return [...world.provinces.values()].filter((p) => p.ownerStateId === stateId);
}

export function citiesOfProvince(world, provinceId) {
  return [...world.cities.values()].filter((c) => c.provinceId === provinceId);
}

export function worldCounts(world) {
  return {
    states: world.states.size,
    anchors: world.anchors.size,
    provinces: world.provinces.size,
    cities: world.cities.size,
  };
}
