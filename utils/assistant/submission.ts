export function assistantSubmissionStatus(response: string): 'submitted' | 'failed' | 'pending' {
  if (/(?:could not|couldn.t|cannot|can.t|unable|failed).{0,80}(?:submit|send|process|book|schedule)|(?:request|submission|booking).{0,80}(?:failed|unsuccessful)|\b(?:not|never)(?:\s+(?:yet|be|been|successfully|actually)){0,4}\s+(?:submitted|sent|received|booked|scheduled)/i.test(response)) {
    return 'failed';
  }
  if (/(?:will|would|can|could) (?:be )?(?:submitted|sent|received|booked|scheduled)/i.test(response)) return 'pending';
  const statements = response.split(/(?<=[.!?])\s+|\n/).filter(sentence => !sentence.trim().endsWith('?')).join(' ');
  if (/(?:request|details|information|application|tour|booking).{0,80}(?:submitted|sent|received|booked|scheduled)|successfully (?:submitted|sent|booked|scheduled).{0,80}(?:request|application|tour|booking)/i.test(statements)) {
    return 'submitted';
  }
  return 'pending';
}
