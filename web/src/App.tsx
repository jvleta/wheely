import { useCallback, useMemo, useState } from "react";
import type { Data, Frame, SliderStep } from "plotly.js";
import Plot from "./plotly";
import { loadWheelyModule } from "./wasm";

type ResultSummary = {
  peakTheta: number;
  peakMass: number;
  frameCount: number;
};

const defaultConfig = {
  n_cups: 8,
  radius: 1.3,
  g: 9.81,
  damping: 2.25,
  leak_rate: 0.10,
  inflow_rate: 0.90,
  inertia: 5.3,
  omega0: 1.0,
  t_start: 0,
  t_end: 90,
  n_frames: 500,
  steps_per_frame: 6
} as const;

type SimulationConfig = typeof defaultConfig;

type PlotReadyData = {
  times: number[];
  theta: number[];
  massesByFrame: number[][];
  cupCount: number;
  radius: number;
  massRange: { min: number; max: number };
  positionsByFrame: Array<{
    x: number[];
    y: number[];
    masses: number[];
  }>;
};

function formatNumber(value: number): string {
  return value.toFixed(3);
}

export default function App() {
  const [status, setStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [summary, setSummary] = useState<ResultSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<SimulationConfig>(() => ({ ...defaultConfig }));
  const [plotData, setPlotData] = useState<PlotReadyData | null>(null);

  const handleRun = useCallback(async () => {
    setStatus("loading");
    setError(null);
    setSummary(null);
    setPlotData(null);
    try {
      const module = await loadWheelyModule();
      const result = module.simulate(config);
      const times = module.vectorToArray(result.times);
      const theta = module.vectorToArray(result.theta);
      const masses = module.vectorToArray(result.masses);

      const peakTheta = theta.reduce((acc: number, value: number) => Math.max(acc, Math.abs(value)), 0);
      const peakMass = masses.reduce((acc: number, value: number) => Math.max(acc, Math.abs(value)), 0);
      const frameCount = times.length;
      const cupCount = config.n_cups;
      let minMass = Number.POSITIVE_INFINITY;
      let maxMass = Number.NEGATIVE_INFINITY;
      const massesByFrame = Array.from({ length: frameCount }, (_, frameIndex) =>
        Array.from({ length: cupCount }, (_, cupIndex) => {
          const value = masses[cupIndex * frameCount + frameIndex] ?? 0;
          if (value < minMass) {
            minMass = value;
          }
          if (value > maxMass) {
            maxMass = value;
          }
          return value;
        })
      );
      if (!Number.isFinite(minMass) || !Number.isFinite(maxMass)) {
        minMass = 0;
        maxMass = 0;
      }
      const angleStep = (2 * Math.PI) / cupCount;
      const radius = Math.abs(config.radius);
      const positionsByFrame = massesByFrame.map((massesForFrame, frameIndex) => {
        const thetaValue = theta[frameIndex];
        const x = Array.from({ length: cupCount }, (_, cupIndex) =>
          radius * Math.cos(thetaValue + angleStep * cupIndex)
        );
        const y = Array.from({ length: cupCount }, (_, cupIndex) =>
          radius * Math.sin(thetaValue + angleStep * cupIndex)
        );
        return { x, y, masses: massesForFrame };
      });

      setSummary({
        peakTheta,
        peakMass,
        frameCount: times.length
      });
      setPlotData({
        times,
        theta,
        massesByFrame,
        cupCount,
        radius,
        massRange: { min: minMass, max: maxMass },
        positionsByFrame
      });
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("idle");
    }
  }, [config]);

  const handleChange = useCallback(
    (key: keyof SimulationConfig, rawValue: string) => {
      setConfig((prev) => {
        const nextValue = Number(rawValue);
        if (Number.isNaN(nextValue)) {
          return prev;
        }
        return { ...prev, [key]: nextValue };
      });
    },
    []
  );

  const handleReset = useCallback(() => {
    setConfig({ ...defaultConfig });
    setSummary(null);
    setPlotData(null);
  }, []);

  const thetaPlot = useMemo(() => {
    if (!plotData) {
      return null;
    }
    return (
      <Plot
        data={[
          {
            x: plotData.times,
            y: plotData.theta,
            type: "scatter",
            mode: "lines",
            name: "θ(t)"
          }
        ]}
        layout={{
          title: "Angular Displacement",
          xaxis: { title: "Time (s)" },
          yaxis: { title: "θ (rad)" },
          margin: { t: 40, r: 20, b: 40, l: 60 }
        }}
        config={{ responsive: true, displaylogo: false }}
        style={{ width: "100%", height: "100%" }}
      />
    );
  }, [plotData]);

  const massAnimationPlot = useMemo(() => {
    if (!plotData || plotData.massesByFrame.length === 0) {
      return null;
    }

    const cupIndices = Array.from({ length: plotData.cupCount }, (_, index) => index + 1);
    const { min: massMin, max: massMax } = plotData.massRange;
    const colorMax = massMax > massMin ? massMax : massMin + 1e-6;
    const frames: Frame[] = plotData.massesByFrame.map((frameMasses, frameIndex) => ({
      name: frameIndex.toString(),
      group: "mass",
      baseframe: "",
      traces: [0],
      layout: {},
      data: [
        {
          type: "bar",
          x: cupIndices,
          y: frameMasses,
          marker: {
            color: frameMasses,
            colorscale: "Turbo",
            cmin: massMin,
            cmax: colorMax
          }
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

    return (
      <Plot
        data={[
          {
            type: "bar",
            x: cupIndices,
            y: plotData.massesByFrame[0],
            marker: {
              color: plotData.massesByFrame[0],
              colorscale: "Turbo",
              cmin: massMin,
              cmax: colorMax,
              colorbar: { title: { text: "Mass" } }
            },
            name: "Cup mass"
          }
        ]}
        frames={frames}
        layout={{
          title: "Cup Mass Distribution (Animated)",
          xaxis: {
            title: "Cup index",
            tickmode: "linear",
            dtick: 1,
            range: [0.5, plotData.cupCount + 0.5]
          },
          yaxis: { title: "Mass" },
          margin: { t: 40, r: 20, b: 60, l: 60 },
          updatemenus: [
            {
              type: "buttons",
              showactive: false,
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
              currentvalue: { prefix: "Time (s): " },
              pad: { t: 30 },
              steps: sliderSteps
            }
          ]
        }}
        config={{ responsive: true, displaylogo: false }}
        style={{ width: "100%", height: "100%" }}
      />
    );
  }, [plotData]);

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
            size: 18,
            color: frame.masses,
            colorscale: "Turbo",
            cmin: massMin,
            cmax: colorMax
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
              size: 18,
              color: initialFrame.masses,
              colorscale: "Turbo",
              cmin: massMin,
              cmax: colorMax,
              colorbar: { title: { text: "Mass" } }
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
            line: { dash: "dot", color: "#888", width: 2 },
            name: "Wheel rim",
            hoverinfo: "skip",
            showlegend: false
          }
        ]}
        frames={frames}
        layout={{
          title: "Wheel Geometry",
          xaxis: {
            title: "x (m)",
            range: [-axisExtent, axisExtent],
            scaleanchor: "y",
            scaleratio: 1
          },
          yaxis: {
            title: "y (m)",
            range: [-axisExtent, axisExtent]
          },
          margin: { t: 40, r: 30, b: 60, l: 60 },
          showlegend: false,
          updatemenus: [
            {
              type: "buttons",
              showactive: false,
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
              currentvalue: { prefix: "Time (s): " },
              pad: { t: 30 },
              steps: sliderSteps
            }
          ]
        }}
        config={{ responsive: true, displaylogo: false }}
        style={{ width: "100%", height: "100%" }}
      />
    );
  }, [plotData]);

  const renderField = (
    key: keyof SimulationConfig,
    label: string,
    min?: number,
    step?: number
  ) => (
    <label key={key} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <input
        type="number"
        value={config[key]}
        onChange={(event) => handleChange(key, event.target.value)}
        min={min}
        step={step ?? "any"}
        style={{ padding: "0.4rem", borderRadius: "0.4rem", border: "1px solid #ccc", fontSize: "1rem" }}
      />
    </label>
  );

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: "1rem", alignItems: "stretch", padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: "880px", margin: "0 auto" }}>
      <h1>Water Wheel Demo</h1>
      <p>
        Click the button to run the Lorenz water wheel simulation inside WebAssembly. The configuration mirrors the default
        Python run.
      </p>
      <section style={{ display: "flex", flexDirection: "column", gap: "1rem", border: "1px solid #e0e0e0", borderRadius: "0.8rem", padding: "1.5rem", backgroundColor: "#fafafa" }}>
        <h2>Simulation Parameters</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          {renderField("n_cups", "Number of cups", 1, 1)}
          {renderField("radius", "Radius (m)", 0)}
          {renderField("g", "Gravity (m/s²)", 0)}
          {renderField("damping", "Damping", 0)}
          {renderField("leak_rate", "Leak rate", 0)}
          {renderField("inflow_rate", "Inflow rate", 0)}
          {renderField("inertia", "Inertia", 0)}
          {renderField("omega0", "Initial angular velocity")}
          {renderField("t_start", "Start time (s)")}
          {renderField("t_end", "End time (s)")}
          {renderField("n_frames", "Frames", 2, 1)}
          {renderField("steps_per_frame", "Steps per frame", 1, 1)}
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button type="button" onClick={handleRun} disabled={status === "loading"} style={{ padding: "0.5rem 1.25rem", fontSize: "1rem", cursor: status === "loading" ? "wait" : "pointer" }}>
            {status === "loading" ? "Running…" : "Run Simulation"}
          </button>
          <button type="button" onClick={handleReset} disabled={status === "loading"} style={{ padding: "0.5rem 1.25rem", fontSize: "1rem" }}>
            Reset to defaults
          </button>
        </div>
      </section>
      {error && (
        <p style={{ color: "crimson" }}>
          Failed to run simulation: {error}
        </p>
      )}
      {status === "ready" && summary && (
        <section>
          <h2>Result Snapshot</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            <li>Frames simulated: {summary.frameCount}</li>
            <li>Peak |θ|: {formatNumber(summary.peakTheta)}</li>
            <li>Peak cup mass: {formatNumber(summary.peakMass)}</li>
          </ul>
          <p style={{ fontSize: "0.9rem", color: "#555" }}>
            For charting, consume the raw arrays exposed by the module: times, theta, and masses.
          </p>
        </section>
      )}
      {plotData && (
        <section style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <h2>Visualizations</h2>
          {geometryPlot && <div style={{ minHeight: "420px" }}>{geometryPlot}</div>}
          {thetaPlot && <div style={{ minHeight: "320px" }}>{thetaPlot}</div>}
          {massAnimationPlot && <div style={{ minHeight: "380px" }}>{massAnimationPlot}</div>}
        </section>
      )}
    </main>
  );
}
