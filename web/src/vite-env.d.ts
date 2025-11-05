/// <reference types="vite/client" />

declare module "@wasm/wheely_wasm.js" {
  const createModule: () => Promise<unknown>;
  export default createModule;
}
