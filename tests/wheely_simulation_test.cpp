#include <gtest/gtest.h>

#include "../src/wheely_simulation.cpp"

namespace wheely {
namespace {

SimulationConfig make_valid_config() {
    SimulationConfig cfg;
    cfg.n_cups = 2;
    cfg.radius = 1.0;
    cfg.g = 9.81;
    cfg.damping = 0.05;
    cfg.leak_rate = 0.02;
    cfg.inflow_rate = 0.5;
    cfg.inertia = 1.5;
    cfg.omega0 = 0.0;
    cfg.t_start = 0.0;
    cfg.t_end = 1.0;
    cfg.n_frames = 5;
    cfg.steps_per_frame = 2;
    return cfg;
}

}  // namespace

TEST(WheelyValidateConfigTest, AcceptsValidConfiguration) {
    EXPECT_NO_THROW(validate_config(make_valid_config()));
}

TEST(WheelyValidateConfigTest, RejectsInvalidCupCount) {
    auto cfg = make_valid_config();
    cfg.n_cups = 0;
    EXPECT_THROW(validate_config(cfg), std::invalid_argument);
}

TEST(WheelyValidateConfigTest, RejectsInsufficientFrames) {
    auto cfg = make_valid_config();
    cfg.n_frames = 1;
    EXPECT_THROW(validate_config(cfg), std::invalid_argument);
}

TEST(WheelyValidateConfigTest, RejectsNonIncreasingTime) {
    auto cfg = make_valid_config();
    cfg.t_end = cfg.t_start;
    EXPECT_THROW(validate_config(cfg), std::invalid_argument);
}

TEST(WheelyValidateConfigTest, RejectsNonPositiveStepsPerFrame) {
    auto cfg = make_valid_config();
    cfg.steps_per_frame = 0;
    EXPECT_THROW(validate_config(cfg), std::invalid_argument);
}

TEST(WheelyComputeDerivativesTest, ComputesTorqueAndAngularAcceleration) {
    auto cfg = make_valid_config();
    cfg.n_cups = 1;
    cfg.inertia = 2.0;
    cfg.damping = 0.5;
    cfg.leak_rate = 0.1;
    cfg.inflow_rate = 1.0;

    std::vector<double> state{0.0, 1.0, 2.0};
    const auto derivatives = compute_derivatives(state, cfg);

    ASSERT_EQ(derivatives.size(), state.size());
    EXPECT_DOUBLE_EQ(derivatives[0], 1.0);
    EXPECT_NEAR(derivatives[1], -0.25, 1e-9);
    EXPECT_NEAR(derivatives[2], 0.8, 1e-9);
}

TEST(WheelyComputeDerivativesTest, AppliesLeakOutsideInflowWindow) {
    auto cfg = make_valid_config();
    cfg.n_cups = 1;
    cfg.leak_rate = 0.25;
    cfg.inflow_rate = 2.0;

    std::vector<double> state{0.2, 0.0, 4.0};
    const auto derivatives = compute_derivatives(state, cfg);

    ASSERT_EQ(derivatives.size(), state.size());
    EXPECT_NEAR(derivatives[2], -cfg.leak_rate * state[2], 1e-9);
}

TEST(WheelyRk4StepTest, AdvancesAngleWithConstantAngularVelocity) {
    auto cfg = make_valid_config();
    cfg.n_cups = 1;
    cfg.damping = 0.0;
    cfg.leak_rate = 0.0;
    cfg.inflow_rate = 0.0;
    cfg.g = 9.81;
    cfg.radius = 1.0;
    cfg.inertia = 1.0;

    std::vector<double> state{0.0, 1.0, 0.0};
    rk4_step(state, 0.1, cfg);

    EXPECT_NEAR(state[0], 0.1, 1e-6);
    EXPECT_NEAR(state[1], 1.0, 1e-9);
    EXPECT_NEAR(state[2], 0.0, 1e-9);
}

TEST(WheelySimulateTest, ThrowsOnInvalidConfiguration) {
    auto cfg = make_valid_config();
    cfg.n_cups = 0;
    EXPECT_THROW(simulate(cfg), std::invalid_argument);
}

TEST(WheelySimulateTest, ProducesExpectedFramesAndAngles) {
    auto cfg = make_valid_config();
    cfg.n_cups = 1;
    cfg.steps_per_frame = 5;
    cfg.n_frames = 3;
    cfg.omega0 = 1.0;
    cfg.damping = 0.0;
    cfg.inertia = 1.0;
    cfg.leak_rate = 0.0;
    cfg.inflow_rate = 0.0;
    cfg.t_end = 1.0;

    const auto result = simulate(cfg);

    ASSERT_EQ(result.times.size(), cfg.n_frames);
    ASSERT_EQ(result.theta.size(), cfg.n_frames);
    ASSERT_EQ(result.masses.size(), cfg.n_cups * cfg.n_frames);

    EXPECT_DOUBLE_EQ(result.times[0], cfg.t_start);
    EXPECT_DOUBLE_EQ(result.times[1], 0.5);
    EXPECT_DOUBLE_EQ(result.times[2], 1.0);

    EXPECT_NEAR(result.theta[0], 0.0, 1e-9);
    EXPECT_NEAR(result.theta[1], 0.5, 1e-6);
    EXPECT_NEAR(result.theta[2], 1.0, 1e-6);

    for (double mass : result.masses) {
        EXPECT_DOUBLE_EQ(mass, 0.0);
    }
}

}  // namespace wheely
