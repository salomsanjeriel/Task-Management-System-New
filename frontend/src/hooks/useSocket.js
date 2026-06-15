import { useEffect } from 'react';
import { socketService } from '../services/socketService.js';

/**
 * Subscribe to a socket event. Automatically cleans up on unmount.
 * @param {string}   event    - Socket event name
 * @param {Function} handler  - Callback when event fires
 */
export function useSocket(event, handler) {
  useEffect(() => {
    socketService.on(event, handler);
    return () => {
      socketService.off(event, handler);
    };
  }, [event, handler]);
}