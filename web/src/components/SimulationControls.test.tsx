import { fireEvent, render, screen } from "@testing-library/react";
import SimulationControls from "./SimulationControls";
import type { SimulationConfig } from "../App";

const baseConfig: SimulationConfig = {
  n_cups: 8,
  radius: 1,
  g: 9.81,
  damping: 2,
  leak_rate: 0.1,
  inflow_rate: 0.9,
  inertia: 5,
  omega0: 1,
  t_start: 0,
  t_end: 90,
  n_frames: 500,
  steps_per_frame: 6
};

const defaultProps = {
  config: baseConfig,
  status: "idle" as const,
  error: null,
  onRun: jest.fn(),
  onReset: jest.fn(),
  onRunAwayPreset: jest.fn(),
  onChange: jest.fn()
};

function setup(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides };
  render(<SimulationControls {...props} />);
  return props;
}

beforeEach(() => {
  jest.clearAllMocks();
});

it("invokes onRun when clicking Run Simulation", () => {
  const props = setup();
  fireEvent.click(screen.getByRole("button", { name: /run simulation/i }));
  expect(props.onRun).toHaveBeenCalledTimes(1);
});

it("propagates field changes through onChange callbacks", () => {
  const onChange = jest.fn();
  setup({ onChange });
  fireEvent.change(screen.getByLabelText(/wheel radius/i), { target: { value: "2.5" } });
  expect(onChange).toHaveBeenCalledWith("radius", "2.5");
});

it("renders error message feedback when provided", () => {
  setup({ error: "Nope" });
  expect(screen.getByText(/failed to run simulation/i)).toBeInTheDocument();
});
