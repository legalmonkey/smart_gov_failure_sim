export interface Scenario {
  id: string;
  name: string;
  description?: string;
  category?: 'grid' | 'flood' | 'transport' | 'multi-sector' | 'custom';
  failures: string[];
  interventions: string[];
  budget: number;
  duration: number;
  random_seed?: number;
  impactScore?: number;
  populationAffected?: number;
  hospitalDisruptions?: number;
  emergencyDelayMinutes?: number;
}
