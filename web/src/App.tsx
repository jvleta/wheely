import { useCallback, useEffect, useRef, useState } from "react";
import { loadWheelyModule } from "./wasm";
import SimulationControls from "./components/SimulationControls";
import SimulationPlotPanel from "./components/SimulationPlotPanel";
import { zenburnPalette } from "./theme";

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
};

const runAwayConfig = {
  n_cups: 8,
  radius: 1.0,
  g: 9.81,
  damping: 0.00,
  leak_rate: 0.00,
  inflow_rate: 1.0,
  inertia: 1.0,
  omega0: 1.0,
  t_start: 0.0,
  t_end: 10.0,
  n_frames: 500,
  steps_per_frame: 500
};

export type SimulationConfig = typeof defaultConfig;
export type SimulationStatus = "idle" | "loading" | "ready";

export type PlotReadyData = {
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
  const [status, setStatus] = useState<SimulationStatus>("idle");
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

  const handleRunAwayPreset = useCallback(() => {
    setConfig({ ...runAwayConfig });
    setPlotData(null);
    setError(null);
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
        <SimulationControls
          config={config}
          status={status}
          error={error}
          onRun={handleRun}
          onReset={handleReset}
          onRunAwayPreset={handleRunAwayPreset}
          onChange={handleChange}
        />
        <SimulationPlotPanel status={status} plotData={plotData} />
      </div>
    </main>
  );
}
