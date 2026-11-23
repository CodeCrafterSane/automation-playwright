export function tourContactFields(response: string): ('name' | 'email' | 'phone')[] {
  const questions = response.match(/[^.!?]*\?/g);
  const question = questions?.at(-1) || response.split(/\n\s*\n/).at(-1) || response;
  const fields: ('name' | 'email' | 'phone')[] = [];
  if (/\bname\b|first and last/i.test(question)) fields.push('name');
  if (/\be-?mail\b/i.test(question)) fields.push('email');
  if (/\bphone\b|\bmobile\b|contact number/i.test(question)) fields.push('phone');
  return fields;
}
