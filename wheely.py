import json
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation, PillowWriter
from scipy.integrate import solve_ivp

try:
    import wheely_cpp # type: ignore
except ImportError:
    wheely_cpp = None

# -----------------------------
# 📥 Load config from JSON
# -----------------------------
default_config = {
    "N_CUPS": 12,
    "RADIUS": 1.0,
    "G": 9.81,
    "DAMPING": 1.0,
    "LEAK_RATE": 1.0,
    "INFLOW_RATE": 5.0,
    "INERTIA": 1.0,
    "OMEGA0": 0.1,
    "T_START": 0,
    "T_END": 40,
    "N_FRAMES": 1000,
    "OUTPUT_FILE": "lorenz_water_wheel.gif",
    "FPS": 25
}

# Try loading external config
try:
    with open("wheel_config.json", "r") as f:
        user_config = json.load(f)
    config = {**default_config, **user_config}
except FileNotFoundError:
    config = default_config

# -----------------------------
# 🧠 ODE Definition
# -----------------------------
def water_wheel_ode(t, state, N, R, g, gamma, k, Q, I):
    theta = state[0]
    omega = state[1]
    m = state[2:]
    dmdt = np.zeros(N)
    angles = theta + np.linspace(0, 2 * np.pi, N, endpoint=False)
    torque = np.sum(m * g * R * np.sin(angles))
    domega_dt = (-gamma * omega + torque) / I

    for i in range(N):
        phi = angles[i] % (2 * np.pi)
        if phi < 0.1 or phi > 2 * np.pi - 0.1:
            dmdt[i] = Q - k * m[i]
        else:
            dmdt[i] = -k * m[i]

    dtheta_dt = omega
    return np.concatenate(([dtheta_dt, domega_dt], dmdt))

def simulate_python(cfg):
    t_eval = np.linspace(cfg["T_START"], cfg["T_END"], cfg["N_FRAMES"])
    state0 = np.zeros(cfg["N_CUPS"] + 2)
    state0[1] = cfg["OMEGA0"]
    sol = solve_ivp(
        water_wheel_ode,
        (cfg["T_START"], cfg["T_END"]),
        state0,
        t_eval=t_eval,
        args=(
            cfg["N_CUPS"],
            cfg["RADIUS"],
            cfg["G"],
            cfg["DAMPING"],
            cfg["LEAK_RATE"],
            cfg["INFLOW_RATE"],
            cfg["INERTIA"]
        )
    )
    return t_eval, sol.y[0], sol.y[2:]


def run_simulation(cfg, prefer_cpp=True, steps_per_frame=4):
    if prefer_cpp and wheely_cpp is not None:
        try:
            return wheely_cpp.simulate(cfg, steps_per_frame)
        except Exception as exc:
            print(f"Falling back to SciPy solver (C++ module failed: {exc})")
    return simulate_python(cfg)


times, theta_vals, cup_masses = run_simulation(config)
times = np.asarray(times)
theta_vals = np.asarray(theta_vals)
cup_masses = np.asarray(cup_masses)
num_frames = theta_vals.shape[0]

# -----------------------------
# 🎞️ Animation Setup
# -----------------------------
fig, ax = plt.subplots(figsize=(6, 6))
cup_dots, = ax.plot([], [], 'bo', markersize=8)
cup_texts = [ax.text(0, 0, '', ha='center', va='center', fontsize=8) for _ in range(config["N_CUPS"])]

def init():
    ax.set_xlim(-1.2, 1.2)
    ax.set_ylim(-1.2, 1.2)
    ax.set_aspect('equal')
    ax.set_title('Lorenz Water Wheel Simulation')
    return [cup_dots] + cup_texts

def update(frame):
    theta = theta_vals[frame]
    masses = cup_masses[:, frame]
    angles = theta + np.linspace(0, 2 * np.pi, config["N_CUPS"], endpoint=False)
    x = config["RADIUS"] * np.cos(angles)
    y = config["RADIUS"] * np.sin(angles)
    cup_dots.set_data(x, y)

    for i, txt in enumerate(cup_texts):
        txt.set_position((1.1 * x[i], 1.1 * y[i]))
        txt.set_text(f'{masses[i]:.1f}')

    return [cup_dots] + cup_texts

ani = FuncAnimation(fig, update, frames=num_frames, init_func=init, blit=True, interval=1000/config["FPS"])

# Save as GIF
# ani.save(config["OUTPUT_FILE"], writer=PillowWriter(fps=config["FPS"]))
plt.show()
