export interface UploadedFormula {formula: string; annotation: string; line?: number}
export interface ParsedKBFile {rows: UploadedFormula[]; goal?: string}

export function splitFormulaAnnotation(text: string): UploadedFormula {
  const separator = text.indexOf('::');
  const formula = (separator < 0 ? text : text.slice(0, separator)).trim();
  if (!formula) throw new Error('Enter a formula before ::');
  return {formula, annotation: separator < 0 ? '' : text.slice(separator + 2).trim()};
}

export function parseKBContent(filename: string, content: string): ParsedKBFile {
  if (!filename.toLowerCase().endsWith('.json')) {
    const rows: UploadedFormula[] = [];
    content.split(/\r?\n/).forEach((line, index) => {
      if (!line.trim() || line.trimStart().startsWith('#')) return;
      try {rows.push({...splitFormulaAnnotation(line), line: index + 1});}
      catch (error) {throw new Error(`Line ${index + 1}: ${error instanceof Error ? error.message : 'Invalid formula.'}`, {cause: error});}
    });
    return {rows};
  }
  let data: unknown;
  try {data = JSON.parse(content);} catch {throw new Error('The uploaded file is not valid JSON.');}
  let entries: unknown; let goal: unknown; let annotations: unknown;
  if (Array.isArray(data)) entries = data;
  else if (data && typeof data === 'object') {
    const object = data as Record<string, unknown>;
    entries = object.formulas ?? object.knowledge_base ?? object.knowledgeBase;
    goal = object.goal ?? object.query;
    annotations = object.annotations;
  }
  if (!Array.isArray(entries)) throw new Error('JSON must contain a formulas or knowledge_base array.');
  if (goal != null && typeof goal !== 'string') throw new Error('The uploaded query or goal must be text.');
  if (annotations != null && (!Array.isArray(annotations) || annotations.length !== entries.length || annotations.some(note => typeof note !== 'string'))) throw new Error('annotations must contain one text value per formula; use an empty string for no annotation.');
  const notes = annotations as string[] | undefined;
  const rows = entries.map((entry: unknown, index): UploadedFormula => {
    let row: UploadedFormula;
    if (typeof entry === 'string') row = splitFormulaAnnotation(entry);
    else if (entry && typeof entry === 'object' && typeof (entry as Record<string, unknown>).formula === 'string') {
      const object = entry as {formula: string; annotation?: unknown};
      row = splitFormulaAnnotation(object.formula);
      if (object.annotation !== undefined) {
        if (typeof object.annotation !== 'string') throw new Error(`Formula ${index + 1}: annotation must be text.`);
        row.annotation = object.annotation.trim();
      }
    } else throw new Error(`Formula ${index + 1}: use formula text or an object with formula and optional annotation.`);
    return {...row, annotation: notes?.[index]?.trim() ?? row.annotation};
  });
  return {rows, goal: typeof goal === 'string' ? goal : undefined};
}
