# WHEELY

## Build the C++ extension

1. Install prerequisites (within your virtualenv): `pip install pybind11`.
2. Configure the project: `cmake -S . -B build -DPython3_EXECUTABLE=$(which python3)`.
3. Build the module: `cmake --build build`.
4. Add the build folder to `PYTHONPATH` (for example `export PYTHONPATH=$PYTHONPATH:$(pwd)/build`) before running the Python script.

## Run the demo

```
python wheely.py
```

When the extension is available the simulation uses the C++ integrator; otherwise it falls back to SciPy.
