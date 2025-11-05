cmake_minimum_required(VERSION 3.14)
project(wheely_cpp LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

find_package(Python3 COMPONENTS Interpreter Development.Module REQUIRED)

if(NOT DEFINED pybind11_DIR)
    execute_process(
        COMMAND "${Python3_EXECUTABLE}" -m pybind11 --cmakedir
        OUTPUT_VARIABLE _pybind11_cmake_dir
        OUTPUT_STRIP_TRAILING_WHITESPACE
        ERROR_QUIET
    )
    if(_pybind11_cmake_dir)
        list(APPEND CMAKE_PREFIX_PATH "${_pybind11_cmake_dir}")
    endif()
endif()

find_package(pybind11 CONFIG REQUIRED)

pybind11_add_module(wheely_cpp
    src/wheely_module.cpp
    src/wheely_simulation.cpp
)

target_compile_features(wheely_cpp PRIVATE cxx_std_17)
target_compile_options(
    wheely_cpp
    PRIVATE
        -Wall
        -Wextra
        -Wpedantic
)
find_program(EMSCRIPTEN_CXX NAMES em++)

if(EMSCRIPTEN_CXX)
    set(WASM_OUTPUT_DIR "${CMAKE_CURRENT_BINARY_DIR}/wasm")
    set(WASM_JS "${WASM_OUTPUT_DIR}/wheely_wasm.js")
    set(WASM_WASM "${WASM_OUTPUT_DIR}/wheely_wasm.wasm")

    add_custom_command(
        OUTPUT "${WASM_JS}"
        BYPRODUCTS "${WASM_WASM}"
        COMMAND "${CMAKE_COMMAND}" -E make_directory "${WASM_OUTPUT_DIR}"
        COMMAND "${EMSCRIPTEN_CXX}"
            "${CMAKE_CURRENT_SOURCE_DIR}/src/wheely_wasm.cpp"
            "${CMAKE_CURRENT_SOURCE_DIR}/src/wheely_simulation.cpp"
            -O3
            -std=c++17
            --bind
            -sMODULARIZE=1
            -sEXPORT_ES6=1
            -sEXPORT_NAME="wheelyWasmModule"
            -sALLOW_MEMORY_GROWTH=1
            -DNDEBUG
            -o "${WASM_JS}"
        DEPENDS
            "${CMAKE_CURRENT_SOURCE_DIR}/src/wheely_wasm.cpp"
            "${CMAKE_CURRENT_SOURCE_DIR}/src/wheely_simulation.cpp"
            "${CMAKE_CURRENT_SOURCE_DIR}/src/wheely_simulation.h"
        COMMENT "Building Emscripten WebAssembly module"
        VERBATIM
    )

    add_custom_target(wheely_wasm DEPENDS "${WASM_JS}")
endif()
