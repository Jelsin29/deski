import type { DeskiApi } from '../shared/deski-api.js';

declare global {
  interface Window {
    /** Exposed by the preload script; see src/preload/index.cts. */
    readonly deski: DeskiApi;
  }
}
