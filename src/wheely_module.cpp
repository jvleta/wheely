#include "wheely_simulation.h"

#include <pybind11/numpy.h>
#include <pybind11/pybind11.h>
#include <pybind11/stl.h>

#include <algorithm>
#include <stdexcept>
#include <string>
#include <vector>

namespace py = pybind11;

namespace {

wheely::SimulationConfig make_config_from_dict(const py::dict &data,
                                               std::size_t steps_per_frame) {
    auto require = [&](const char *key) -> py::handle {
        if (!data.contains(key)) {
            throw std::invalid_argument(std::string("Missing key: ") + key);
        }
        return data[key];
    };

    wheely::SimulationConfig cfg;
    cfg.n_cups = require("N_CUPS").cast<std::size_t>();
    cfg.radius = require("RADIUS").cast<double>();
    cfg.g = require("G").cast<double>();
    cfg.damping = require("DAMPING").cast<double>();
    cfg.leak_rate = require("LEAK_RATE").cast<double>();
    cfg.inflow_rate = require("INFLOW_RATE").cast<double>();
    cfg.inertia = require("INERTIA").cast<double>();
    cfg.omega0 = require("OMEGA0").cast<double>();
    cfg.t_start = require("T_START").cast<double>();
    cfg.t_end = require("T_END").cast<double>();
    cfg.n_frames = require("N_FRAMES").cast<std::size_t>();
    cfg.steps_per_frame = steps_per_frame;

    if (cfg.n_cups < 1) {
        throw std::invalid_argument("N_CUPS must be positive");
    }
    if (cfg.n_frames < 2) {
        throw std::invalid_argument("N_FRAMES must be at least 2");
    }
    if (cfg.t_end <= cfg.t_start) {
        throw std::invalid_argument("T_END must be greater than T_START");
    }
    if (cfg.steps_per_frame < 1) {
        throw std::invalid_argument("steps_per_frame must be positive");
    }

    return cfg;
}

py::tuple to_python(const wheely::SimulationResult &result,
                    std::size_t n_cups) {
    const std::size_t n_frames = result.theta.size();

    py::array_t<double> times_array(n_frames);
    std::copy(result.times.begin(), result.times.end(),
              times_array.mutable_data());

    py::array_t<double> theta_array(n_frames);
    std::copy(result.theta.begin(), result.theta.end(),
              theta_array.mutable_data());

    py::array_t<double> masses_array({n_cups, n_frames});
    double *mass_ptr = masses_array.mutable_data();
    std::copy(result.masses.begin(), result.masses.end(), mass_ptr);

    return py::make_tuple(times_array, theta_array, masses_array);
}

py::tuple simulate_impl(const wheely::SimulationConfig &cfg) {
    return to_python(wheely::simulate(cfg), cfg.n_cups);
}

}  // namespace

PYBIND11_MODULE(wheely_cpp, m) {
    m.doc() = "Water wheel simulation powered by C++ and exposed via pybind11";

    m.def(
        "simulate",
        [](const py::dict &config, std::size_t steps_per_frame) {
            return simulate_impl(make_config_from_dict(config, steps_per_frame));
        },
        py::arg("config"),
        py::arg("steps_per_frame") = 4,
        "Run the Lorenz water wheel simulation.\n\n"
        "Parameters\n"
        "----------\n"
        "config : dict\n"
        "    Dictionary containing the simulation parameters. The following\n"
        "    keys are required: N_CUPS, RADIUS, G, DAMPING, LEAK_RATE,\n"
        "    INFLOW_RATE, INERTIA, OMEGA0, T_START, T_END, N_FRAMES.\n"
        "steps_per_frame : int, optional\n"
        "    Number of integration sub-steps to take per output frame.\n"
        "    Increasing this value improves accuracy at the cost of runtime.\n\n"
        "Returns\n"
        "-------\n"
        "tuple of numpy.ndarray\n"
        "    (times, theta, masses) where times and theta are 1D arrays and\n"
        "    masses is a 2D array with shape (N_CUPS, N_FRAMES).");
}
