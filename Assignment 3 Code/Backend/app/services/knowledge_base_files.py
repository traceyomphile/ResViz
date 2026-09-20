"""Separate optional annotations from logical formulas before parsing."""
import json


def split_formula_annotation(text: str) -> tuple[str, str]:
    formula, separator, annotation = text.partition('::')
    formula = formula.strip()
    if not formula:
        raise ValueError('Enter a formula before ::')
    return formula, annotation.strip() if separator else ''


def parse_knowledge_base_file(filename: str, content: str) -> tuple[list[str], list[str], str | None]:
    if not filename.lower().endswith('.json'):
        formulas, annotations = [], []
        for index, line in enumerate(content.splitlines(), 1):
            if not line.strip() or line.lstrip().startswith('#'):
                continue
            try:
                formula, annotation = split_formula_annotation(line)
            except ValueError as exc:
                raise ValueError(f'Line {index}: {exc}') from exc
            formulas.append(formula)
            annotations.append(annotation)
        return formulas, annotations, None
    data = json.loads(content)
    query, supplied_annotations = None, None
    if isinstance(data, list):
        entries = data
    elif isinstance(data, dict):
        entries = data.get('formulas', data.get('knowledge_base', data.get('knowledgeBase')))
        query = data.get('goal', data.get('query'))
        supplied_annotations = data.get('annotations')
    else:
        entries = None
    if not isinstance(entries, list):
        raise ValueError('JSON must contain a formulas or knowledge_base array')
    if query is not None and not isinstance(query, str):
        raise ValueError('The uploaded query or goal must be a string')
    if supplied_annotations is not None and (not isinstance(supplied_annotations, list) or len(supplied_annotations) != len(entries) or not all(isinstance(note, str) for note in supplied_annotations)):
        raise ValueError('annotations must contain one text value per formula; use an empty string for no annotation')
    formulas, annotations = [], []
    for index, entry in enumerate(entries):
        if isinstance(entry, str):
            formula, annotation = split_formula_annotation(entry)
        elif isinstance(entry, dict) and isinstance(entry.get('formula'), str):
            formula, annotation = split_formula_annotation(entry['formula'])
            note = entry.get('annotation', annotation)
            if not isinstance(note, str):
                raise ValueError(f'Formula {index + 1}: annotation must be text')
            annotation = note.strip()
        else:
            raise ValueError(f'Formula {index + 1}: use formula text or an object with formula and optional annotation')
        if supplied_annotations is not None:
            annotation = supplied_annotations[index].strip()
        formulas.append(formula)
        annotations.append(annotation)
    return formulas, annotations, query
