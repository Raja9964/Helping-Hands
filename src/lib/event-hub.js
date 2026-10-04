import { EventEmitter } from 'node:events';

// In-process pub/sub for the admin live feed. Running more than one instance
// would need a shared channel (Redis, or MongoDB change streams) instead.
export function createEventHub() {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0);

  return {
    publish(type, data) {
      emitter.emit('event', { type, data });
    },
    subscribe(listener) {
      emitter.on('event', listener);
      return () => emitter.off('event', listener);
    },
    onClose(listener) {
      emitter.once('close', listener);
      return () => emitter.off('close', listener);
    },
    close() {
      emitter.emit('close');
    },
  };
}
