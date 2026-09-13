"""
Track 2: Cascade & Time Simulation Engine.
Calculates failure propagation, state transitions, backup depletion, and recovery dynamics
for infrastructure networks in accordance with the 5-track resilience specification.
"""

from .models import (
    NetworkNode,
    NetworkEdge,
    NetworkGraph,
    SimulationState,
    SimulationEvent,
    SimulationEventCollection,
    SimulationResult,
    Scenario,
    SimulationConfig,
)
from .engine import SimulationEngine

__all__ = [
    "NetworkNode",
    "NetworkEdge",
    "NetworkGraph",
    "SimulationState",
    "SimulationEvent",
    "SimulationEventCollection",
    "SimulationResult",
    "Scenario",
    "SimulationConfig",
    "SimulationEngine",
]
