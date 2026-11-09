export function stripCodeFences(value: string): string {
  return value
    .replace(/^\s*```(?:json|sql)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export function extractJsonObject(responseText: string): string {
  const cleaned = stripCodeFences(responseText);
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace === -1) return cleaned;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = firstBrace; index < cleaned.length; index += 1) {
    const char = cleaned[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return cleaned.slice(firstBrace, index + 1);
    }
  }

  return cleaned.slice(firstBrace);
}
