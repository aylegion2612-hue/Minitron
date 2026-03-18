declare global {
  interface Window {
    minitron: {
      getCoreUrl(): Promise<string>;
    };
  }
}

export {};
