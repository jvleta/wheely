import type { SimulationConfig, SimulationStatus } from "../App";
import { zenburnPalette } from "../theme";

type SimulationControlsProps = {
  config: SimulationConfig;
  status: SimulationStatus;
  error: string | null;
  onRun: () => void;
  onReset: () => void;
  onRunAwayPreset: () => void;
  onChange: (key: keyof SimulationConfig, rawValue: string) => void;
};

export default function SimulationControls({
  config,
  status,
  error,
  onRun,
  onReset,
  onRunAwayPreset,
  onChange
}: SimulationControlsProps) {
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
        onChange={(event) => onChange(key, event.target.value)}
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
            onClick={onRun}
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
            onClick={onReset}
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
            Preset 1: Default Config
          </button>
          <button
            type="button"
            onClick={onRunAwayPreset}
            disabled={status === "loading"}
            style={{
              padding: "0.55rem 1.5rem",
              fontSize: "1rem",
              cursor: status === "loading" ? "not-allowed" : "pointer",
              borderRadius: "0.6rem",
              border: `1px solid ${zenburnPalette.accentAlt}`,
              fontWeight: 600,
              color: zenburnPalette.accentAlt,
              background: zenburnPalette.surface,
              minWidth: "160px",
              opacity: status === "loading" ? 0.75 : 1,
              transition: "transform 0.2s ease, box-shadow 0.2s ease"
            }}
          >
            Preset 2: Runaway Wheel
          </button>
        </div>
        {error && (
          <p style={{ color: zenburnPalette.danger, margin: 0, textAlign: "center" }}>
            Failed to run simulation: {error}
          </p>
        )}
      </div>
    </section>
  );
}
