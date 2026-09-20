import type {ResolutionClause} from '../api/knowledgeBase';

export interface ResolutionChoice {
  partner: ResolutionClause;
  pivot: string;
  expression: string;
  blocked: 'Tautology' | null;
  alreadyAvailable: boolean;
}
function literals(expression: string): Set<string> {
  return new Set(expression === '□' ? [] : expression.split('|').map(value => value.trim()));
}
function complement(literal: string): string {return literal.startsWith('~') ? literal.slice(1) : `~${literal}`;}
function key(values: Set<string>): string {return [...values].sort().join(' | ') || '□';}

// Resolve exactly one complementary pair at a time. Multiple pivots remain
// separate choices; cancelling them together would be an unsound inference.
export function resolutionChoices(selected: ResolutionClause, available: ResolutionClause[]): ResolutionChoice[] {
  const left = literals(selected.expression);
  const existing = new Set(available.map(clause => key(literals(clause.expression))));
  const choices: ResolutionChoice[] = [];
  for (const partner of available) {
    if (partner.id === selected.id) continue;
    const right = literals(partner.expression);
    for (const pivot of [...left].sort()) {
      if (!right.has(complement(pivot))) continue;
      const result = new Set([...left].filter(value => value !== pivot));
      for (const value of right) if (value !== complement(pivot)) result.add(value);
      const expression = key(result);
      const tautology = [...result].some(value => result.has(complement(value)));
      choices.push({partner, pivot, expression, blocked: tautology ? 'Tautology' : null, alreadyAvailable: existing.has(expression)});
    }
  }
  return choices;
}
