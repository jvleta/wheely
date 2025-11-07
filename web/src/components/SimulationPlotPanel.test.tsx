import { render, screen } from "@testing-library/react";
import SimulationPlotPanel from "./SimulationPlotPanel";
import type { PlotReadyData } from "../App";

jest.mock("../plotly", () => ({
  __esModule: true,
  default: () => <div data-testid="plot-mock">Plot</div>
}));

const samplePlotData: PlotReadyData = {
  times: [0],
  theta: [0],
  massesByFrame: [[1, 2]],
  cupCount: 2,
  radius: 1,
  massRange: { min: 1, max: 2 },
  positionsByFrame: [
    {
      x: [0, 1],
      y: [0, 1],
      masses: [1, 2]
    }
  ]
};

it("shows loading state copy while simulation runs", () => {
  render(<SimulationPlotPanel status="loading" plotData={null} />);
  expect(screen.getByText(/running simulation/i)).toBeInTheDocument();
});

it("shows empty-state hint when no plot data is available", () => {
  render(<SimulationPlotPanel status="idle" plotData={null} />);
  expect(screen.getByText(/run the simulation/i)).toBeInTheDocument();
});

it("renders plot once data is available", () => {
  render(<SimulationPlotPanel status="ready" plotData={samplePlotData} />);
  expect(screen.getByTestId("plot-mock")).toBeInTheDocument();
});
