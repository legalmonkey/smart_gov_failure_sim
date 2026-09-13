from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any


@dataclass
class NodeCriticality:
    asset_id: str
    criticality_score: float
    baseline_impact: float
    removal_impact: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "asset_id": self.asset_id,
            "criticality_score": round(self.criticality_score, 2),
            "baseline_impact": round(self.baseline_impact, 2),
            "removal_impact": round(self.removal_impact, 2),
        }


@dataclass
class EdgeCriticality:
    edge_id: str
    criticality_score: float
    baseline_impact: float
    removal_impact: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "edge_id": self.edge_id,
            "criticality_score": round(self.criticality_score, 2),
            "baseline_impact": round(self.baseline_impact, 2),
            "removal_impact": round(self.removal_impact, 2),
        }


@dataclass
class CriticalityResult:
    scenario_id: str
    nodes: List[NodeCriticality]
    edges: List[EdgeCriticality]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scenario_id": self.scenario_id,
            "nodes": [n.to_dict() for n in self.nodes],
            "edges": [e.to_dict() for e in self.edges],
        }


@dataclass
class Intervention:
    id: str
    name: str
    target_types: List[str]
    cost: int
    effects: Dict[str, Any]
    constraints: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "target_types": self.target_types,
            "cost": self.cost,
            "effects": self.effects,
            "constraints": self.constraints,
        }


@dataclass
class SelectedIntervention:
    intervention_id: str
    target_asset_id: str
    cost: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "intervention_id": self.intervention_id,
            "target_asset_id": self.target_asset_id,
            "cost": self.cost,
        }


@dataclass
class InterventionRequest:
    scenario_id: str
    intervention_id: str
    target_asset_id: str


@dataclass
class OptimizationResult:
    scenario_id: str
    budget: int
    selected_interventions: List[SelectedIntervention]
    total_cost: int
    baseline_impact: float
    optimized_impact: float
    impact_reduction: float
    roi_score: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scenario_id": self.scenario_id,
            "budget": self.budget,
            "selected_interventions": [i.to_dict() for i in self.selected_interventions],
            "total_cost": self.total_cost,
            "baseline_impact": round(self.baseline_impact, 2),
            "optimized_impact": round(self.optimized_impact, 2),
            "impact_reduction": round(self.impact_reduction, 2),
            "roi_score": round(self.roi_score, 2),
        }


@dataclass
class UserPlanResult:
    scenario_id: str
    budget: int
    selected_interventions: List[SelectedIntervention]
    total_cost: int
    baseline_impact: float
    resulting_impact: float
    impact_reduction: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scenario_id": self.scenario_id,
            "budget": self.budget,
            "selected_interventions": [i.to_dict() for i in self.selected_interventions],
            "total_cost": self.total_cost,
            "baseline_impact": round(self.baseline_impact, 2),
            "resulting_impact": round(self.resulting_impact, 2),
            "impact_reduction": round(self.impact_reduction, 2),
        }


@dataclass
class AdvisorPlanSummary:
    impact: float
    impact_reduction: float
    total_cost: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "impact": round(self.impact, 2),
            "impact_reduction": round(self.impact_reduction, 2),
            "total_cost": self.total_cost,
        }


@dataclass
class AdvisorResult:
    scenario_id: str
    user_plan: AdvisorPlanSummary
    optimal_plan: AdvisorPlanSummary
    missed_critical_assets: List[str]
    missed_critical_edges: List[str]
    priority_reasons: List[str]
    recommendations: List[str] = field(default_factory=list)
    advisor_text: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scenario_id": self.scenario_id,
            "user_plan": self.user_plan.to_dict(),
            "optimal_plan": self.optimal_plan.to_dict(),
            "missed_critical_assets": self.missed_critical_assets,
            "missed_critical_edges": self.missed_critical_edges,
            "priority_reasons": self.priority_reasons,
            "recommendations": self.recommendations,
            "advisor_text": self.advisor_text,
        }
