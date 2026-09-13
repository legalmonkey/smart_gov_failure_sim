# Track 2: Cascade & Time Simulation Engine
### Powai Lake & Hiranandani Infrastructure Resilience Simulator

Track 2 provides the core discrete-time mathematical simulation engine for infrastructure cascade failures, capacity degradation, backup power depletion, and recovery cycles.

---

## Architecture & Features
- **Deterministic Time Stepping**: Discrete time advancement ($t_0, t_1, \dots, t_N$ hours) parameterized via `config.json`.
- **Canonical 6-State Lifecycle**:
  `OPERATIONAL` → `DEGRADED` → `BACKUP` → `CRITICAL` → `FAILED` → `RECOVERING` → `OPERATIONAL`.
- **Physics & Dependencies**:
  - Upstream supply to downstream dependency propagation across directed edges (`power_dependency`, `water_dependency`, `road_connection`, `service_dependency`).
  - Automatic backup power generator engagement and fuel/battery depletion.
  - Overload threshold trips when redistributed loads exceed capacity limits.
  - Multi-stage repair and restoration cycles.
- **Contract Conformance**:
  - Consumes `network.json`, `scenario.json`, and `config.json`.
  - Produces standardized `SimulationState` (Contract C11), `SimulationEvent` streams (Contract C12), and `SimulationResult` summaries (Contract C13) for Tracks 3, 4, and 5.

---

## API Usage

```python
from engine import SimulationEngine
from graph import load_network
from models import Scenario

# 1. Load network graph
network = load_network("fixtures/test_network.json")

# 2. Initialize engine
engine = SimulationEngine(network)

# 3. Trigger initial disruptions
engine.trigger_failure("power_station_01")

# 4. Step simulation forward in time (0.1 hours)
state = engine.step_simulation(0.1)
print(f"Time: {state.time}h | Failed: {state.failed_nodes} | Backup: {state.backup_nodes}")

# 5. Or execute an entire scenario run
scenario = Scenario(
    id="scenario_01",
    name="Grid Failure",
    failures=["power_station_01"],
    duration=24.0
)
result = engine.run_simulation(scenario=scenario)
print(f"Run completed with {len(result.events)} cascade events.")
```

---

## Running Tests

Execute the comprehensive unit and contract test suite:

```powershell
python -m unittest discover -s tests
```
