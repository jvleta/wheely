type VectorHandle = {
  size: () => number;
  get: (index: number) => number;
  delete?: () => void;
};

type WheelyModule = {
  simulate: (config: Record<string, number>) => {
    times: VectorHandle;
    theta: VectorHandle;
    masses: VectorHandle;
  };
  destroy: (value: unknown) => void;
};

type ExtendedModule = WheelyModule & {
  vectorToArray: (vector: VectorHandle) => number[];
};

let cachedModule: Promise<ExtendedModule> | null = null;

function vectorToArray(vector: VectorHandle): number[] {
  const count = vector.size();
  const output = new Array<number>(count);
  for (let i = 0; i < count; ++i) {
    output[i] = vector.get(i);
  }
  vector.delete?.();
  return output;
}

export async function loadWheelyModule(): Promise<ExtendedModule> {
  if (!cachedModule) {
    cachedModule = (async () => {
      const factory = await import("@wasm/wheely_wasm.js");
      const module = (await factory.default()) as WheelyModule;
      return Object.assign(module, { vectorToArray });
    })();
  }
  return cachedModule;
}
