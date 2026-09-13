from typing import List, Dict, Any, Optional
from impact.models import NetworkGraph, SimulationState, Scenario
from impact.impact_engine import ImpactEngine

from .models import (
    CriticalityResult,
    OptimizationResult,
    UserPlanResult,
    AdvisorResult,
    Intervention,
    SelectedIntervention
)
from .criticality.node_criticality import calculate_node_criticality
from .criticality.edge_criticality import calculate_edge_criticality
from .interventions.catalog import get_default_catalog, load_catalog
from .optimization.budget_optimizer import BudgetOptimizer
from .advisor.ai_advisor import AIAdvisor


class Track4Engine:
    """
    Master Track 4 Engine: Criticality, Optimization & AI Advisor.
    Section 4 of Implementation Guide.
    """

    def __init__(self, impact_engine: Optional[ImpactEngine] = None):
        self.impact_engine = impact_engine or ImpactEngine()
        self.optimizer = BudgetOptimizer(self.impact_engine)
        self.catalog = load_catalog()

    def calculate_criticality(
        self,
        network: NetworkGraph,
        scenario_id: str = "scenario_01",
        base_sim_state: Optional[SimulationState] = None
    ) -> CriticalityResult:
        """Calculates systematic node and edge criticality via graph removal."""
        nodes = calculate_node_criticality(network, self.impact_engine, scenario_id, base_sim_state)
        edges = calculate_edge_criticality(network, self.impact_engine, scenario_id, base_sim_state)
        return CriticalityResult(scenario_id=scenario_id, nodes=nodes, edges=edges)

    def optimize_budget(
        self,
        network: NetworkGraph,
        sim_state: SimulationState,
        scenario: Scenario,
        budget: int,
        catalog: Optional[List[Intervention]] = None
    ) -> OptimizationResult:
        """Calculates optimal intervention combination minimizing impact within budget."""
        cat = catalog or self.catalog
        return self.optimizer.optimize(network, sim_state, scenario, budget, cat)

    def evaluate_user_plan(
        self,
        network: NetworkGraph,
        sim_state: SimulationState,
        scenario: Scenario,
        budget: int,
        selected: List[SelectedIntervention],
        catalog: Optional[List[Intervention]] = None
    ) -> UserPlanResult:
        """Evaluates cascade impact of user-selected interventions."""
        cat = catalog or self.catalog
        return self.optimizer.evaluate_user_plan(network, sim_state, scenario, budget, selected, cat)

    def generate_advisor_analysis(
        self,
        user_plan: UserPlanResult,
        optimal_plan: OptimizationResult,
        criticality: CriticalityResult,
        network: NetworkGraph
    ) -> AdvisorResult:
        """Generates structured comparison and factual AI advice."""
        return AIAdvisor.generate_advice(user_plan, optimal_plan, criticality, network)
