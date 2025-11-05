#ifndef WHEELY_SIMULATION_H
#define WHEELY_SIMULATION_H

#include <cstddef>
#include <vector>

namespace wheely {

struct SimulationConfig {
    std::size_t n_cups = 0;
    double radius = 0.0;
    double g = 0.0;
    double damping = 0.0;
    double leak_rate = 0.0;
    double inflow_rate = 0.0;
    double inertia = 0.0;
    double omega0 = 0.0;
    double t_start = 0.0;
    double t_end = 0.0;
    std::size_t n_frames = 0;
    std::size_t steps_per_frame = 0;
};

struct SimulationResult {
    std::vector<double> times;
    std::vector<double> theta;
    std::vector<double> masses;
};

SimulationResult simulate(const SimulationConfig &cfg);

}  // namespace wheely

#endif  // WHEELY_SIMULATION_H