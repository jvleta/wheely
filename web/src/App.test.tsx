import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import { loadWheelyModule } from "./wasm";

jest.mock("./plotly", () => ({
  __esModule: true,
  default: () => <div data-testid="plot-mock">Plot</div>,
}));

jest.mock("./wasm", () => ({
  loadWheelyModule: jest.fn(),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

type LoadedModule = Awaited<ReturnType<typeof loadWheelyModule>>;
type MockModule = jest.Mocked<LoadedModule>;
type SimulationResult = ReturnType<LoadedModule["simulate"]>;
type MockVector = SimulationResult["times"];

const mockLoadWheelyModule = loadWheelyModule as jest.MockedFunction<
  typeof loadWheelyModule
>;

async function renderApp() {
  await act(async () => {
    render(<App />);
    await Promise.resolve();
  });
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function createMockVector(values: number[]): MockVector {
  return {
    size: () => values.length,
    get: (index: number) => values[index],
    delete: () => void 0
  } as MockVector;
}

function createMockModule(): MockModule {
  const frameCount = 3;
  const cupCount = 8;
  const times = Array.from({ length: frameCount }, (_, index) => index * 0.5);
  const theta = Array.from({ length: frameCount }, (_, index) => index * 0.1);
  const masses = Array.from(
    { length: frameCount * cupCount },
    (_, index) => index / 5
  );
  return {
    simulate: jest.fn((_config: Parameters<LoadedModule["simulate"]>[0]) => ({
      times: createMockVector(times),
      theta: createMockVector(theta),
      masses: createMockVector(masses)
    })) as MockModule["simulate"],
    vectorToArray: jest.fn((vector: MockVector) => {
      const count = vector.size();
      const output = new Array<number>(count);
      for (let i = 0; i < count; i += 1) {
        output[i] = vector.get(i);
      }
      vector.delete?.();
      return output;
    }) as MockModule["vectorToArray"],
    destroy: jest.fn()
  } as MockModule;
}

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders primary controls with default values", async () => {
  const mockModule = createMockModule();
  mockLoadWheelyModule.mockResolvedValue(mockModule);

  await renderApp();

  expect(screen.getByRole("heading", { name: /virtual water wheel/i })).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: /run simulation|running/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/number of cups/i)).toHaveValue(8);

  await waitFor(() =>
    expect(screen.getByTestId("plot-mock")).toBeInTheDocument()
  );
});

it("shows loading feedback while simulations are running", async () => {
  const mockModule = createMockModule();
  const deferred = createDeferred<MockModule>();
  mockLoadWheelyModule.mockReturnValue(deferred.promise);

  await renderApp();
  expect(screen.getByText(/running simulation/i)).toBeInTheDocument();

  deferred.resolve(mockModule);

  await waitFor(() =>
    expect(screen.queryByText(/running simulation/i)).not.toBeInTheDocument()
  );
  expect(screen.getByTestId("plot-mock")).toBeInTheDocument();
  expect(mockModule.simulate).toHaveBeenCalledTimes(1);
});

it("applies user input before rerunning simulations", async () => {
  const mockModule = createMockModule();
  mockLoadWheelyModule.mockResolvedValue(mockModule);

  await renderApp();
  await waitFor(() =>
    expect(screen.getByTestId("plot-mock")).toBeInTheDocument()
  );

  fireEvent.change(screen.getByLabelText(/wheel radius/i), {
    target: { value: "2.5" }
  });
  const runButton = await screen.findByRole("button", { name: /run simulation|running/i });
  fireEvent.click(runButton);

  await waitFor(() => expect(mockModule.simulate).toHaveBeenCalledTimes(2));
  const latestConfig = mockModule.simulate.mock.calls.at(-1)?.[0];
  expect(latestConfig?.radius).toBe(2.5);
});
