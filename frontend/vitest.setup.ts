import '@testing-library/jest-dom/vitest';

if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }

  if (!('ResizeObserver' in window)) {
    class ResizeObserver {
      callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }

      observe() {}

      unobserve() {}

      disconnect() {}
    }

    // @ts-expect-error - assigning to window for test polyfill
    window.ResizeObserver = ResizeObserver;
  }
}
