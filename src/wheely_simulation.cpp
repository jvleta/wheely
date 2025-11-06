#include "wheely_simulation.h"

#include <algorithm>
#include <cmath>
#include <stdexcept>

namespace wheely {
namespace {

constexpr double PI = 3.14159265358979323846;
constexpr double TWO_PI = 2.0 * PI;

void validate_config(const SimulationConfig &cfg) {
    if (cfg.n_cups < 1) {
        throw std::invalid_argument("n_cups must be positive");
    }
    if (cfg.n_frames < 2) {
        throw std::invalid_argument("n_frames must be at least 2");
    }
    if (cfg.t_end <= cfg.t_start) {
        throw std::invalid_argument("t_end must be greater than t_start");
    }
    if (cfg.steps_per_frame < 1) {
        throw std::invalid_argument("steps_per_frame must be positive");
    }
}

std::vector<double> compute_derivatives(const std::vector<double> &state,
                                        const SimulationConfig &cfg) {
    std::vector<double> derivatives(state.size());
    const double theta = state[0];
    const double omega = state[1];
    const double cup_angle_step =
        TWO_PI / static_cast<double>(cfg.n_cups);  // equal spacing

    double torque = 0.0;
    for (std::size_t i = 0; i < cfg.n_cups; ++i) {
        const double angle = theta + cup_angle_step * static_cast<double>(i);
        const double mass = state[2 + i];
        torque += mass * cfg.g * cfg.radius * std::sin(angle);
    }

    derivatives[0] = omega;
    derivatives[1] = (-cfg.damping * omega + torque) / cfg.inertia;

    for (std::size_t i = 0; i < cfg.n_cups; ++i) {
        const double angle = theta + cup_angle_step * static_cast<double>(i);
        double phi = std::fmod(angle, TWO_PI);
        if (phi < 0.0) {
            phi += TWO_PI;
        }
        const double mass = state[2 + i];
        if (phi < 0.1 || phi > TWO_PI - 0.1) {
            derivatives[2 + i] = cfg.inflow_rate - cfg.leak_rate * mass;
        } else {
            derivatives[2 + i] = -cfg.leak_rate * mass;
        }
    }

    return derivatives;
}

void rk4_step(std::vector<double> &state, double dt,
              const SimulationConfig &cfg) {
    const std::size_t size = state.size();
    const double half_dt = dt * 0.5;
    const double sixth_dt = dt / 6.0;

    const auto k1 = compute_derivatives(state, cfg);

    std::vector<double> temp(size);
    for (std::size_t i = 0; i < size; ++i) {
        temp[i] = state[i] + half_dt * k1[i];
    }
    const auto k2 = compute_derivatives(temp, cfg);

    for (std::size_t i = 0; i < size; ++i) {
        temp[i] = state[i] + half_dt * k2[i];
    }
    const auto k3 = compute_derivatives(temp, cfg);

    for (std::size_t i = 0; i < size; ++i) {
        temp[i] = state[i] + dt * k3[i];
    }
    const auto k4 = compute_derivatives(temp, cfg);

    for (std::size_t i = 0; i < size; ++i) {
        state[i] += sixth_dt * (k1[i] + 2.0 * k2[i] + 2.0 * k3[i] + k4[i]);
    }
}

}  // namespace

SimulationResult simulate(const SimulationConfig &cfg) {
    validate_config(cfg);

    const std::size_t state_size = cfg.n_cups + 2;
    std::vector<double> state(state_size, 0.0);
    state[1] = cfg.omega0;

    const double total_time = cfg.t_end - cfg.t_start;
    const double frame_dt =
        total_time / static_cast<double>(cfg.n_frames - 1);
    const double sub_dt = frame_dt / static_cast<double>(cfg.steps_per_frame);

    SimulationResult result;
    result.times.resize(cfg.n_frames);
    result.theta.resize(cfg.n_frames);
    result.masses.assign(cfg.n_cups * cfg.n_frames, 0.0);

    double current_time = cfg.t_start;
    for (std::size_t frame = 0; frame < cfg.n_frames; ++frame) {
        result.times[frame] = current_time;
        result.theta[frame] = state[0];
        for (std::size_t cup = 0; cup < cfg.n_cups; ++cup) {
            result.masses[cup * cfg.n_frames + frame] = state[2 + cup];
        }

        if (frame + 1 == cfg.n_frames) {
            break;
        }

        for (std::size_t step = 0; step < cfg.steps_per_frame; ++step) {
            rk4_step(state, sub_dt, cfg);
            current_time += sub_dt;
        }
    }

    return result;
}

}  // namespace wheely
