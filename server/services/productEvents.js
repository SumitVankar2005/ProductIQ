import { EventEmitter } from 'node:events';

// A small in-process event bus is enough for the single API server used by
// ProductIQ. It lets the UI receive each saved AI result immediately instead
// of waiting for a complete (and rate-limited) batch to finish.
const productEvents = new EventEmitter();
productEvents.setMaxListeners(0);

export const publishProductUpdate = (product) => {
  productEvents.emit('product:update', product.toObject ? product.toObject() : product);
};

export const publishQueueUpdate = (queue) => productEvents.emit('queue:update', queue);

export default productEvents;
