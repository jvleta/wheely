# WHEELY

WebAssembly build of the wheely simulation plus the React client that consumes it.

## Prerequisites

- Emscripten toolchain with `em++` on your `PATH`
- CMake 3.13+ (used to orchestrate the WASM build)
- Node.js 18+ and npm (for the client)

## Build the WASM module

```bash
cmake -S . -B build
cmake --build build --target wheely_wasm
```

Artifacts land in `build/wasm/wheely_wasm.{js,wasm}`.

## Run the client

```bash
cd web
npm install                      # first time only
npm run sync-wasm                # copies build/wasm artifacts into src/wasm/generated
npm run dev                      # starts Vite on http://localhost:5173
```

Use `npm run build && npm run preview` for a production preview.
