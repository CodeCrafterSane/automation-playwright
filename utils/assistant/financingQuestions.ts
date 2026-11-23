import { financingRequestedFields, type FinancingFlow } from '../financingQuestions';

export function validFinancingQuestions(response: string, flow: FinancingFlow, options: readonly string[] = []) {
  const inferred = financingRequestedFields(response, flow, options);
  if (inferred.includes('confirmed')) return inferred;
  const question = response.split(/\n\s*\n/).at(-1)!;
  const direct = financingRequestedFields(question, flow, options);
  if (direct.length) return direct;
  // Keep the named field in “I need the ZIP code. What is it?” instead of parsing only the pronoun.
  const contextual = financingRequestedFields(question.replace(/\b(?:what is it|what would that be|can you share it)\?/gi, ''), flow, options);
  if (contextual.length) return contextual;
  if (flow === 'purchase' && /(?:property|home).{0,50}(?:cost|price|value)|purchase price/i.test(question)) return ['budget'] as const;
  return [];
}
