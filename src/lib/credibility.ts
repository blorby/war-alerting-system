import { SOURCE_CATEGORIES } from '@/workers/lib/corroboration-config';

const TIER_SCORES: Record<string, number> = {
  official: 90,
  news: 60,
  humanitarian: 55,
  osint: 45,
  social: 30,
  unknown: 20,
};

const CORROBORATION_BONUS = 20;

export function getSourceCategory(source: string): string {
  return SOURCE_CATEGORIES[source] ?? 'unknown';
}

export function computeEventCredibility(source: string, corroborated: boolean): number {
  const category = getSourceCategory(source);
  const base = TIER_SCORES[category] ?? TIER_SCORES.unknown;
  return corroborated ? Math.min(base + CORROBORATION_BONUS, 100) : base;
}

export function computeNewsCredibility(source: string): number {
  const category = getSourceCategory(source);
  if (category === 'unknown') return TIER_SCORES.news;
  return TIER_SCORES[category] ?? TIER_SCORES.news;
}

export type CredibilityLevel = 'high' | 'medium' | 'low';

export function getCredibilityLevel(score: number): CredibilityLevel {
  if (score >= 70) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

export function getCredibilityColor(score: number): { text: string; bg: string } {
  const level = getCredibilityLevel(score);
  switch (level) {
    case 'high':
      return { text: 'text-green-400', bg: 'bg-green-500/20' };
    case 'medium':
      return { text: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    case 'low':
      return { text: 'text-orange-400', bg: 'bg-orange-500/20' };
  }
}
