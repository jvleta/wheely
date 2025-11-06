import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Data, Frame, SliderStep } from "plotly.js";
import Plot from "./plotly";
import { loadWheelyModule } from "./wasm";

const defaultConfig = {
  n_cups: 8,
  radius: 1.0,
  g: 9.81,
  damping: 2.0,
  leak_rate: 0.10,
  inflow_rate: 0.90,
  inertia: 5.0,
  omega0: 1.0,
  t_start: 0,
  t_end: 90,
  n_frames: 500,
  steps_per_frame: 6
} as const;

const zenburnPalette = {
  background: "#3F3F3F",
  surface: "#464646",
  panel: "#2F2F2F",
  border: "#5C5C5C",
  borderSubtle: "#6F6F6F",
  textPrimary: "#DCDCCC",
  textMuted: "#AFAF87",
  accent: "#F0DFAF",
  accentAlt: "#8CD0D3",
  success: "#7F9F7F",
  danger: "#CC9393",
  plotGrid: "#5B605E",
  textOnAccent: "#1E2320"
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
    if (typeof document === "undefined") {
      return;
    }
    const { backgroundColor: previousBackground, color: previousColor } = document.body.style;
    document.body.style.backgroundColor = zenburnPalette.background;
    document.body.style.color = zenburnPalette.textPrimary;
    return () => {
      document.body.style.backgroundColor = previousBackground;
      document.body.style.color = previousColor;
    };
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
            size: 18,
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
              size: 18,
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
              activecolor: zenburnPalette.accentAlt,
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

  const renderField = (
    key: keyof SimulationConfig,
    label: string,
    min?: number,
    step?: number
  ) => (
    <label
      key={key}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.4rem",
        padding: "0.75rem 0.85rem",
        borderRadius: "0.6rem",
        backgroundColor: zenburnPalette.surface,
        border: `1px solid ${zenburnPalette.border}`
      }}
    >
      <span style={{ fontWeight: 600, color: zenburnPalette.accent }}>{label}</span>
      <input
        type="number"
        value={config[key]}
        onChange={(event) => handleChange(key, event.target.value)}
        min={min}
        step={step ?? "any"}
        style={{
          padding: "0.45rem 0.6rem",
          borderRadius: "0.5rem",
          border: `1px solid ${zenburnPalette.borderSubtle}`,
          fontSize: "1rem",
          backgroundColor: zenburnPalette.panel,
          color: zenburnPalette.textPrimary,
          boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.4)"
        }}
      />
    </label>
  );
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
        padding: "2.5rem 2rem 3rem",
        fontFamily: "'Inter', system-ui, sans-serif",
        maxWidth: "1200px",
        width: "100%",
        margin: "0 auto",
        alignItems: "center",
        color: zenburnPalette.textPrimary,
        minHeight: "100vh",
        boxSizing: "border-box"
      }}
    >
      <header
        style={{
          textAlign: "center",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem"
        }}
      >
        <h1 style={{ margin: 0, color: zenburnPalette.accent }}>Virtual Water Wheel</h1>
        <p style={{ margin: 0, color: zenburnPalette.textMuted, fontSize: "0.95rem" }}>
          Adjust the parameters and run the simulation.
        </p>
      </header>
      <div
        style={{
          display: "flex",
          gap: "2rem",
          alignItems: "stretch",
          justifyContent: "center",
          width: "100%",
          alignContent: "stretch",
          flexWrap: "wrap"
        }}
      >
        <section
          style={{
            flex: "0 0 320px",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
            backgroundColor: zenburnPalette.panel,
            borderRadius: "1rem",
            border: `1px solid ${zenburnPalette.border}`,
            padding: "1.5rem",
            boxShadow: "0 20px 35px rgba(0, 0, 0, 0.35)",
            boxSizing: "border-box",
            alignSelf: "stretch",
            height: "100%"
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
            {renderField("n_cups", "Number of cups", 1, 1)}
            {renderField("radius", "Wheel Radius (m)", 0)}
            {renderField("damping", "Damping (kg*m^2/s)", 0)}
            {renderField("leak_rate", "Leak rate (1/s)", 0)}
            {renderField("inflow_rate", "Inflow rate (kg/s)", 0)}
            {renderField("inertia", "Inertia (kg*m^2)", 0)}
          </div>
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
              <button
                type="button"
                onClick={handleRun}
                disabled={status === "loading"}
                style={{
                  padding: "0.55rem 1.5rem",
                  fontSize: "1rem",
                  cursor: status === "loading" ? "wait" : "pointer",
                  borderRadius: "0.6rem",
                  border: "none",
                  fontWeight: 600,
                  color: zenburnPalette.textOnAccent,
                  background:
                    status === "loading"
                      ? zenburnPalette.borderSubtle
                      : `linear-gradient(135deg, ${zenburnPalette.success}, ${zenburnPalette.accent})`,
                  boxShadow: "0 10px 18px rgba(0, 0, 0, 0.4)",
                  minWidth: "160px",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease",
                  opacity: status === "loading" ? 0.85 : 1
                }}
              >
                {status === "loading" ? "Running…" : "Run Simulation"}
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={status === "loading"}
                style={{
                  padding: "0.55rem 1.5rem",
                  fontSize: "1rem",
                  cursor: status === "loading" ? "not-allowed" : "pointer",
                  borderRadius: "0.6rem",
                  border: `1px solid ${zenburnPalette.borderSubtle}`,
                  fontWeight: 500,
                  color: zenburnPalette.accentAlt,
                  background: "transparent",
                  minWidth: "160px",
                  opacity: status === "loading" ? 0.75 : 1,
                  transition: "transform 0.2s ease, box-shadow 0.2s ease"
                }}
              >
                Reset to defaults
              </button>
            </div>
            {error && (
              <p style={{ color: zenburnPalette.danger, margin: 0, textAlign: "center" }}>
                Failed to run simulation: {error}
              </p>
            )}
          </div>
        </section>
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
      </div>
    </main>
  );
}
