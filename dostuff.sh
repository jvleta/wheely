#!/bin/zsh
set -e

cmake -S . -B build
cmake --build build --target wheely_wasm