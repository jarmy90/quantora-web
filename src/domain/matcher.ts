/**
 * Guided selector ("Matcher") — an explainable, educational tool.
 *
 * The user answers four questions (market context, risk tolerance, experience,
 * time/frequency). Each strategy scores 1 point per matching attribute, ties
 * are broken by Power Score, and every match explains WHY it appeared. The tool
 * is explicitly NOT investment advice and never recommends buying anything.
 */
import type { StrategyProfile } from './product';
import { profiles } from './product';

export type MatcherAnswer = 'any' | 'trend' | 'range' | 'volatile' | 'multi' | 'low' | 'medium' | 'high' | 'beginner' | 'intermediate' | 'advanced';

export type MatcherQuestion = {
  id: 'context' | 'risk' | 'experience' | 'frequency';
  title: string;
  hint: string;
  options: { value: MatcherAnswer; label: string; detail: string }[];
};

export const MATCHER_QUESTIONS: MatcherQuestion[] = [
  {
    id: 'context',
    title: 'What kind of market are you expecting?',
    hint: 'Choose the market behavior you think is most likely over your horizon.',
    options: [
      { value: 'trend', label: 'Trending', detail: 'Clear directional moves' },
      { value: 'range', label: 'Range-bound', detail: 'Sideways, mean-reverting' },
      { value: 'volatile', label: 'High volatility', detail: 'Sharp swings in both directions' },
      { value: 'multi', label: 'Uncertain / mixed', detail: 'No strong conviction' },
      { value: 'any', label: 'Not sure', detail: 'I want to see everything' },
    ],
  },
  {
    id: 'risk',
    title: 'How much drawdown can you accept?',
    hint: 'Be honest — drawdown is the price of staying invested.',
    options: [
      { value: 'low', label: 'Very little', detail: 'Under ~10% would be uncomfortable' },
      { value: 'medium', label: 'Moderate', detail: '10–20% is acceptable' },
      { value: 'high', label: 'High', detail: 'I can handle 20%+ drawdowns' },
      { value: 'any', label: 'Not sure', detail: 'Show me the range first' },
    ],
  },
  {
    id: 'experience',
    title: 'How much trading experience do you have?',
    hint: 'There is no wrong answer — it helps us show the right starting point.',
    options: [
      { value: 'beginner', label: 'New to this', detail: 'I follow rules, I do not design them' },
      { value: 'intermediate', label: 'Some experience', detail: 'I have traded a few strategies' },
      { value: 'advanced', label: 'Experienced', detail: 'I am comfortable with aggressive profiles' },
      { value: 'any', label: 'Prefer not to say', detail: 'Skip this filter' },
    ],
  },
  {
    id: 'frequency',
    title: 'How much time can you spend monitoring?',
    hint: 'High-frequency strategies need more screen time and discipline.',
    options: [
      { value: 'low', label: 'Very little', detail: 'A few minutes a week' },
      { value: 'medium', label: 'Some', detail: 'A few minutes a day' },
      { value: 'high', label: 'A lot', detail: 'I can watch the charts regularly' },
      { value: 'any', label: 'Not sure', detail: 'Skip this filter' },
    ],
  },
];

export type MatcherAnswers = Partial<Record<MatcherQuestion['id'], MatcherAnswer>>;

export type MatchedStrategy = {
  profile: StrategyProfile;
  matched: number; // how many attributes matched
  reasons: string[];
};

function answerMatches(answer: MatcherAnswer | undefined, value: string): boolean {
  return answer === undefined || answer === 'any' || answer === (value as MatcherAnswer);
}

export function runMatcher(answers: MatcherAnswers): MatchedStrategy[] {
  const list = profiles.map((profile) => {
    const reasons: string[] = [];
    if (answerMatches(answers.context, profile.marketContext)) {
      reasons.push('Fits your expected market context');
    }
    if (answerMatches(answers.risk, profile.riskLevel)) {
      reasons.push('Matches your drawdown tolerance');
    }
    if (answerMatches(answers.experience, profile.experienceLevel)) {
      reasons.push('Matches your experience level');
    }
    if (answerMatches(answers.frequency, profile.frequency)) {
      reasons.push('Fits the time you can dedicate');
    }
    return { profile, matched: reasons.length, reasons };
  });
  return list.sort((a, b) => b.matched - a.matched || b.profile.metrics.powerScore - a.profile.metrics.powerScore);
}

export const MATCHER_DISCLAIMER =
  'This tool only filters and explains catalog attributes. It is an educational exercise, not investment advice, and it never recommends a specific strategy or trade.';
