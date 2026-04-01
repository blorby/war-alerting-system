export type ThreatTrend = 'escalating' | 'de-escalating' | 'stable';

export interface CountryThreat {
  id: string;
  assessmentId: string;
  countryCode: string;
  countryName: string;
  score: number;
  trend: ThreatTrend;
  summary: string | null;
}

export interface ThreatAssessment {
  id: string;
  createdAt: Date;
  overallScore: number;
  overallTrend: ThreatTrend;
  situationText: string;
  trendText: string;
  overallText: string;
  countries: CountryThreat[];
}
