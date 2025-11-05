#include "wheely_simulation.h"

#include <emscripten/bind.h>

namespace {

wheely::SimulationResult run_simulation(const wheely::SimulationConfig &cfg) {
    return wheely::simulate(cfg);
}

}  // namespace

EMSCRIPTEN_BINDINGS(wheely_wasm_module) {
    emscripten::register_vector<double>("VectorDouble");

    emscripten::value_object<wheely::SimulationConfig>("SimulationConfig")
        .field("n_cups", &wheely::SimulationConfig::n_cups)
        .field("radius", &wheely::SimulationConfig::radius)
        .field("g", &wheely::SimulationConfig::g)
        .field("damping", &wheely::SimulationConfig::damping)
        .field("leak_rate", &wheely::SimulationConfig::leak_rate)
        .field("inflow_rate", &wheely::SimulationConfig::inflow_rate)
        .field("inertia", &wheely::SimulationConfig::inertia)
        .field("omega0", &wheely::SimulationConfig::omega0)
        .field("t_start", &wheely::SimulationConfig::t_start)
        .field("t_end", &wheely::SimulationConfig::t_end)
        .field("n_frames", &wheely::SimulationConfig::n_frames)
        .field("steps_per_frame", &wheely::SimulationConfig::steps_per_frame);

    emscripten::value_object<wheely::SimulationResult>("SimulationResult")
        .field("times", &wheely::SimulationResult::times)
        .field("theta", &wheely::SimulationResult::theta)
        .field("masses", &wheely::SimulationResult::masses);

    emscripten::function("simulate", &run_simulation);
}
