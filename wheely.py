import json
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation, PillowWriter
from scipy.integrate import solve_ivp

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

# -----------------------------
# ⏱️ Solve ODE
# -----------------------------
t_eval = np.linspace(config["T_START"], config["T_END"], config["N_FRAMES"])
initial_state = np.zeros(config["N_CUPS"] + 2)
initial_state[1] = config["OMEGA0"]

sol = solve_ivp(
    water_wheel_ode,
    (config["T_START"], config["T_END"]),
    initial_state,
    t_eval=t_eval,
    args=(
        config["N_CUPS"],
        config["RADIUS"],
        config["G"],
        config["DAMPING"],
        config["LEAK_RATE"],
        config["INFLOW_RATE"],
        config["INERTIA"]
    )
)

theta_vals = sol.y[0]
cup_masses = sol.y[2:]

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

ani = FuncAnimation(fig, update, frames=config["N_FRAMES"], init_func=init, blit=True, interval=1000/config["FPS"])

# Save as GIF
# ani.save(config["OUTPUT_FILE"], writer=PillowWriter(fps=config["FPS"]))
plt.show()
