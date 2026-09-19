// Layer contract (ADR-010): every map system — present or future — is an
// isolated layer. Layers never import each other. The registry fixes paint
// order; displayList calls builders; backend dispatches painters.
// A future sea/land/terrain layer plugs in here without touching coastline.

// Order is load-bearing: sea → [future fills] → coastline → markers → fade.
export const LAYER_ORDER = ['sea', 'coastline', 'markers', 'edge-fade'];

export function createLayerRegistry(extra = []) {
  const order = [...LAYER_ORDER];
  for (const layer of extra) {
    if (!order.includes(layer)) order.push(layer);
  }
  return Object.freeze({
    order: Object.freeze(order),
    has: (id) => order.includes(id),
  });
}
