import {describe, expect, it} from 'vitest';

import {validateFormula, validateKBFile} from '@resviz/types/validator';


describe('formula validation', () => {
    it.each([
        'A',
        'Applicant',
        '(A & B)',
        'A -> B',
        'A → B',
        '~A',
        'A <-> B',
        'A ↔ B',
    ])('accepts valid formula %s', (formula) => {
        expect(validateFormula(formula)).toEqual({valid: true});
    });

    it.each(['', 'A ->', '(A & B', 'A + B', '()', 'A B']) (
        'rejects invalid formula %s',
        (formula) => expect(validateFormula(formula).valid).toBe(false),
    );
});

describe('uploaded knowledge-base validation', () => {
    it('accepts valid line-based KB files', async () => {
        const result = await validateKBFile(new File(['A\r\nA -> B'], 'rules.kb'));
        expect(result).toEqual({valid: true, errors: []});
    });

    it('reports the line number of an invalid text formula', async () => {
        const result = await validateKBFile(new File(['A\r\nB ->'], 'rules.txt'));
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toMatchObject({line: 2, formula: 'B ->'});
    });

    it('accepts a JSON formulas array', async () => {
        const result = await validateKBFile(new File(['{"formulas":["A","A -> B"]}'], 'rules.json'));
        expect(result.valid).toBe(true);
    });

    it('rejects malformed JSON', async () => {
        const result = await validateKBFile(new File(['{'], 'rules.json'));
        expect(result.valid).toBe(false);
        expect(result.errors[0].error).toMatch(/not valid JSON/i);
    });

    it('rejects unsupported extensions', async () => {
        const result = await validateKBFile(new File(['A'], 'rules.csv'));
        expect(result.valid).toBe(false);
        expect(result.errors[0].error).toMatch(/Only .txt, .kb and .json/i);
    });

    it('rejects empty files', async () => {
        const result = await validateKBFile(new File([''], 'rules.txt'));
        expect(result.valid).toBe(false);
        expect(result.errors[0].error).toMatch(/empty/i);
    });

    it.fails('rejects files larger than the intended frontend one-megabyte limit', async () => {
        const oversized = {
            name: 'rules.txt',
            size: 1024 ** 2 + 1,
            text: async () => 'A',
        } as File;
        const result = await validateKBFile(oversized);
        expect(result.valid).toBe(false);
        expect(result.errors[0].error).toMatch(/larger than 1 MB/i);
    });
});
