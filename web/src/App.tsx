import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Data, Frame, SliderStep } from "plotly.js";
import Plot from "./plotly";
import { loadWheelyModule } from "./wasm";

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

export default function App() {
  const [status, setStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<SimulationConfig>(() => ({ ...defaultConfig }));
  const [plotData, setPlotData] = useState<PlotReadyData | null>(null);
  const latestRunRef = useRef(0);

  const handleRun = useCallback(async () => {
    const runId = ++latestRunRef.current;
    setStatus("loading");
    setError(null);
    setPlotData(null);
    try {
      const module = await loadWheelyModule();
      const result = module.simulate(config);
      const times = module.vectorToArray(result.times);
      const theta = module.vectorToArray(result.theta);
      const masses = module.vectorToArray(result.masses);

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

      const nextPlotData: PlotReadyData = {
        times,
        theta,
        massesByFrame,
        cupCount,
        radius,
        massRange: { min: minMass, max: maxMass },
        positionsByFrame
      };
      if (latestRunRef.current !== runId) {
        return;
      }
      setPlotData(nextPlotData);
      setStatus("ready");
    } catch (err) {
      if (latestRunRef.current !== runId) {
        return;
      }
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
    setPlotData(null);
  }, []);

  useEffect(() => {
    void handleRun();
  }, [handleRun]);

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
// TODO: investigate whether we can listen for changes to the input fields and auto-run the simulation. It would be nice to have live updates.
  return (
    <main style={{ display: "flex", gap: "2rem", alignItems: "flex-start", padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: "1200px", margin: "0 auto" }}>
      <section style={{ flex: "0 0 320px", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <h1 style={{ margin: "0 0 0.5rem" }}>Water Wheel</h1>
          <p style={{ margin: 0, color: "#555", fontSize: "0.95rem" }}>Adjust the parameters and run the simulation.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
          {renderField("n_cups", "Number of cups", 1, 1)}
          {renderField("radius", "Radius (m)", 0)}
          {renderField("damping", "Damping", 0)}
          {renderField("leak_rate", "Leak rate", 0)}
          {renderField("inflow_rate", "Inflow rate", 0)}
          {renderField("inertia", "Inertia", 0)}
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button type="button" onClick={handleRun} disabled={status === "loading"} style={{ padding: "0.5rem 1.25rem", fontSize: "1rem", cursor: status === "loading" ? "wait" : "pointer" }}>
            {status === "loading" ? "Running…" : "Run Simulation"}
          </button>
          <button type="button" onClick={handleReset} disabled={status === "loading"} style={{ padding: "0.5rem 1.25rem", fontSize: "1rem" }}>
            Reset to defaults
          </button>
        </div>
        {error && (
          <p style={{ color: "crimson", margin: 0 }}>Failed to run simulation: {error}</p>
        )}
      </section>
      <section style={{ flex: "1 1 auto", minHeight: "520px", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2 style={{ margin: 0 }}>Wheel Animation</h2>
        <div style={{ flex: "1 1 auto", minHeight: "480px", border: "1px solid #e0e0e0", borderRadius: "0.75rem", padding: "1rem", backgroundColor: "#fff", display: "flex", alignItems: "stretch", justifyContent: "center" }}>
          {status === "loading" && (
            <p style={{ margin: "auto", color: "#555" }}>Running simulation…</p>
          )}
          {status !== "loading" && geometryPlot}
          {status !== "loading" && !geometryPlot && (
            <p style={{ margin: "auto", color: "#555" }}>Run the simulation to see the wheel animation.</p>
          )}
        </div>
      </section>
    </main>
  );
}
