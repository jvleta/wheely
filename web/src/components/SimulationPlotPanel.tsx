import { useMemo } from "react";
import type { Data, Frame, SliderStep } from "plotly.js";
import Plot from "../plotly";
import { zenburnPalette } from "../theme";
import type { PlotReadyData, SimulationStatus } from "../App";

type SimulationPlotPanelProps = {
  status: SimulationStatus;
  plotData: PlotReadyData | null;
};

export default function SimulationPlotPanel({ status, plotData }: SimulationPlotPanelProps) {
  const geometryPlot = useMemo(() => {
    if (!plotData || plotData.positionsByFrame.length === 0) {
      return null;
    }

    const circleSegments = 96;
    const circleAngles = Array.from({ length: circleSegments + 1 }, (_, index) => (index / circleSegments) * 2 * Math.PI);
    const circleX = circleAngles.map((angle) => plotData.radius * Math.cos(angle));
    const circleY = circleAngles.map((angle) => plotData.radius * Math.sin(angle));
    const { min: massMin, max: massMax } = plotData.massRange;
    const colorMax = massMax > massMin ? massMax : massMin + 1e-6;
    const massColorscale: [number, string][] = [
      [0, zenburnPalette.panel],
      [0.5, zenburnPalette.success],
      [1, zenburnPalette.accent]
    ];
    const cupLabels = Array.from({ length: plotData.cupCount }, (_, index) => index + 1);
    const frames: Frame[] = plotData.positionsByFrame.map((frame, frameIndex) => ({
      name: frameIndex.toString(),
      group: "geometry",
      baseframe: "",
      traces: [0],
      layout: {},
      data: [
        {
          type: "scatter",
          x: frame.x,
          y: frame.y,
          marker: {
            size: 50,
            color: frame.masses,
            colorscale: massColorscale,
            cmin: massMin,
            cmax: colorMax,
            symbol: "square",
            line: { color: zenburnPalette.borderSubtle, width: 1 }
          },
          text: frame.masses.map((value) => value.toFixed(1)),
          customdata: cupLabels
        } as Data
      ]
    }));

    const sliderSteps: Partial<SliderStep>[] = frames.map((frame, index): Partial<SliderStep> => ({
      label: plotData.times[index].toFixed(2),
      method: "animate",
      args: [
        [frame.name],
        { mode: "immediate", transition: { duration: 0 }, frame: { duration: 0, redraw: false } }
      ]
    }));

    const playArgs = [
      null,
      {
        transition: { duration: 0 },
        frame: { duration: 60, redraw: false },
        fromcurrent: true
      }
    ];

    const initialFrame = plotData.positionsByFrame[0];
    const axisExtent = (plotData.radius || 1) * 1.25;

    return (
      <Plot
        data={[
          {
            type: "scatter",
            mode: "text+markers",
            x: initialFrame.x,
            y: initialFrame.y,
            text: initialFrame.masses.map((value) => value.toFixed(1)),
            textposition: "top center",
            marker: {
              size: 50,
              color: initialFrame.masses,
              colorscale: massColorscale,
              cmin: massMin,
              cmax: colorMax,
              symbol: "square",
              line: { color: zenburnPalette.borderSubtle, width: 1 },
              colorbar: {
                title: { text: "Mass", font: { color: zenburnPalette.textPrimary } },
                bgcolor: "rgba(0,0,0,0)",
                outlinecolor: zenburnPalette.borderSubtle,
                tickfont: { color: zenburnPalette.textPrimary }
              }
            },
            name: "Cups",
            hovertemplate:
              "Cup %{customdata}<br>x: %{x:.2f} m<br>y: %{y:.2f} m<br>Mass: %{marker.color:.2f}<extra></extra>",
            customdata: cupLabels
          },
          {
            type: "scatter",
            mode: "lines",
            x: circleX,
            y: circleY,
            line: { dash: "dot", color: zenburnPalette.accentAlt, width: 2 },
            name: "Wheel rim",
            hoverinfo: "skip",
            showlegend: false
          }
        ]}
        frames={frames}
        layout={{
          title: { text: "Wheel Geometry", font: { color: zenburnPalette.textPrimary } },
          paper_bgcolor: zenburnPalette.background,
          plot_bgcolor: zenburnPalette.panel,
          xaxis: {
            title: { text: "x (m)", font: { color: zenburnPalette.textPrimary } },
            range: [-axisExtent, axisExtent],
            scaleanchor: "y",
            scaleratio: 1,
            gridcolor: zenburnPalette.plotGrid,
            zerolinecolor: zenburnPalette.borderSubtle,
            tickfont: { color: zenburnPalette.textPrimary },
            linecolor: zenburnPalette.borderSubtle
          },
          yaxis: {
            title: { text: "y (m)", font: { color: zenburnPalette.textPrimary } },
            range: [-axisExtent, axisExtent],
            gridcolor: zenburnPalette.plotGrid,
            zerolinecolor: zenburnPalette.borderSubtle,
            tickfont: { color: zenburnPalette.textPrimary },
            linecolor: zenburnPalette.borderSubtle
          },
          margin: { t: 40, r: 50, b: 60, l: 60 },
          showlegend: false,
          font: { color: zenburnPalette.textPrimary },
          updatemenus: [
            {
              type: "buttons",
              showactive: false,
              bgcolor: zenburnPalette.surface,
              bordercolor: zenburnPalette.border,
              buttons: [
                {
                  label: "Play",
                  method: "animate",
                  args: playArgs
                },
                {
                  label: "Pause",
                  method: "animate",
                  args: [
                    [null],
                    { mode: "immediate", transition: { duration: 0 }, frame: { duration: 0, redraw: false } }
                  ]
                }
              ]
            }
          ],
          sliders: [
            {
              active: 0,
              currentvalue: { prefix: "Time (s): ", font: { color: zenburnPalette.textPrimary } },
              pad: { t: 30 },
              steps: sliderSteps,
              bgcolor: zenburnPalette.surface,
              bordercolor: zenburnPalette.border
            }
          ]
        }}
        config={{ responsive: true, displaylogo: false }}
        style={{ width: "100%", height: "100%", backgroundColor: zenburnPalette.panel, borderRadius: "0.5rem" }}
      />
    );
  }, [plotData]);

  return (
    <section
      style={{
        flex: "1 1 auto",
        minHeight: "520px",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        backgroundColor: zenburnPalette.panel,
        borderRadius: "1rem",
        border: `1px solid ${zenburnPalette.border}`,
        padding: "1.5rem",
        boxShadow: "0 20px 35px rgba(0, 0, 0, 0.35)"
      }}
    >
      <div
        style={{
          flex: "1 1 auto",
          minHeight: "480px",
          border: `1px solid ${zenburnPalette.border}`,
          borderRadius: "0.85rem",
          padding: "1rem",
          backgroundColor: zenburnPalette.surface,
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center"
        }}
      >
        {status === "loading" && (
          <p style={{ margin: "auto", color: zenburnPalette.textMuted }}>Running simulation…</p>
        )}
        {status !== "loading" && geometryPlot}
        {status !== "loading" && !geometryPlot && (
          <p style={{ margin: "auto", color: zenburnPalette.textMuted }}>
            Run the simulation to see the wheel animation.
          </p>
        )}
      </div>
    </section>
  );
}
