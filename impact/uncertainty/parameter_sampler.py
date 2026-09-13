import random
from dataclasses import dataclass
from typing import Optional


@dataclass
class OperationalSample:
    """Stochastic realization of operational parameters for a single Monte Carlo run."""
    generator_duration_hours: float
    hospital_load_ratio: float
    water_demand_ratio: float
    recovery_time_hours: float
    road_delay_multiplier: float


class ParameterSampler:
    """
    Samples operational parameters over realistic confidence bounds.
    Follows Section 3.4 of the implementation guide.
    """
    def __init__(self, rng: Optional[random.Random] = None):
        self.rng = rng or random.Random()

    def sample(self) -> OperationalSample:
        # Generator fuel duration: 5.0 to 7.5 hours (Section 3.4: 5–7 hours)
        gen_hours = self.rng.uniform(5.0, 7.5)

        # Hospital operational load: 65% to 85% (Section 3.4: 65–80%)
        hosp_load = self.rng.uniform(0.65, 0.85)

        # Water network demand factor: 80% to 100% (Section 3.4: 80–100%)
        water_demand = self.rng.uniform(0.80, 1.00)

        # Infrastructure recovery time: 2.0 to 6.0 hours (Section 3.4: 2–6 hours)
        recovery_time = self.rng.uniform(2.0, 6.0)

        # Road detour congestion variability
        road_mult = self.rng.uniform(0.85, 1.35)

        return OperationalSample(
            generator_duration_hours=gen_hours,
            hospital_load_ratio=hosp_load,
            water_demand_ratio=water_demand,
            recovery_time_hours=recovery_time,
            road_delay_multiplier=road_mult,
        )
