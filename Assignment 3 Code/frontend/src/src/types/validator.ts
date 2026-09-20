import {parseKBContent} from '../utils/kbFiles';
export interface ValidationRes {
    valid: boolean;
    error?: string;
}

export interface UploadedFormulaError {
    line?: number;
    formulaIndex?: number;
    formula: string;
    error: string;
}

export interface UploadedValidationRes {
     valid: boolean;
     errors: UploadedFormulaError[]
}

/*  operators understood by the validator */

type TokenType = "ATOM" | "NOT" | "AND" | "OR" | "IMPLIES" | "EQUIVALENT" | "LEFT_PAREN" | "RIGHT_PAREN";

interface Token {
    type: TokenType;
    value:string;
    pos: number;
}

class FormulaSyntaxError extends Error {
    constructor(message: string) {
        super(message);
        this.name="FormulaSyntaxError";
    }
}

/*convert the formula into tokens that the parse can understand*/
function  tokenize(formula:string):Token[]{
    const tokens:Token[]=[];
    let pos=0;

    while (pos<formula.length) {
        const char = formula[pos];

        if (/\s/.test(char)){
            pos++;
            continue;
        }

        if (formula.startsWith("<->",pos)){
            tokens.push({
                type: "EQUIVALENT",
                value: "<->",
                pos,
            });

            pos+=3;
            continue;
        }

        if (char === "↔"){
            tokens.push({
                type: "EQUIVALENT",
                value: "↔",
                pos,
            });

            pos++;
            continue;
        }

        if (formula.startsWith("->",pos)){
            tokens.push({
                type: "IMPLIES",
                value: "->",
                pos,
            });

            pos +=2;
            continue;
        }

        if (char === "→"){
            tokens.push({
                type: "IMPLIES",
                value: "→",
                pos,
            });

            pos ++;
            continue;
        }

        if ((char === "~" || char === "¬")){
            tokens.push({
                type: "NOT",
                value: "~",
                pos,
            });

            pos ++;
            continue;
        }

        if ((char === "&" || char === "∧")){
            tokens.push({
                type: "AND",
                value: "&",
                pos,
            });

            pos++;
            continue;
        }

        if ((char === "|" || char === "∨")){
            tokens.push({
                type: "OR",
                value: "|",
                pos,
            });

            pos++;
            continue;
        }

        if (char === "("){
            tokens.push({
                type: "LEFT_PAREN",
                value: "(",
                pos,
            });

            pos++;
            continue;
        }

        if (char === ")"){
            tokens.push({
                type: "RIGHT_PAREN",
                value: ")",
                pos,
            });

            pos++;
            continue;
        }
/*atomic propositions */
        if (/[A-Za-z_]/.test(char)) {
            const start= pos;

            pos++;

            while (
                pos<formula.length &&
                /[A-Za-z0-9_]/.test(formula[pos])
            ) {
                pos++;
            }

            tokens.push({
                type: "ATOM",
                value: formula.slice(start,pos),
                pos: start,
            });

            continue;
        }

        throw new FormulaSyntaxError (
            `Unexpected character "${char}" at position ${pos+1}`
        );
    }

    return tokens;
}

class FormulaParser {
    private current=0;
    private readonly tokens: Token[];

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    parse():void {
        if (this.tokens.length ===0){
            throw new FormulaSyntaxError(
                "formula cannot be empty."
            );
        }

        this.parseEquivalent();

        if (!this.isAtEnd()){
            const token =this.peek();

            throw new FormulaSyntaxError(
                `Unexpected character "${token.value}" at position ${token.pos+1}`
            );
        }
    }

    private parseEquivalent(): void {
        this.parseImplication();

        while (this.match("EQUIVALENT")){
            this.requireExpressionAfterOperator(
                this.previous().value
            );

            this.parseImplication();
        }
    }

    private parseImplication() :void {
        this.parseOr();
        if (this.match("IMPLIES")){
            this.requireExpressionAfterOperator(
                this.previous().value
            );
            this.parseImplication();
        }
    }

    private parseOr(): void {
        this.parseAnd();
        while (this.match("OR")) {
            this.requireExpressionAfterOperator(
                this.previous().value
            );

            this.parseAnd();
        }
    }

    private parseAnd(): void {
        this.parseUnary();

        while (this.match("AND")) {
            this.requireExpressionAfterOperator(
                this.previous().value
            );

            this.parseUnary();
        }
    }

    private parseUnary(): void {
        if (this.match("NOT")) {
            if (this.isAtEnd()) {
                throw new FormulaSyntaxError(
                    'Expected a proposition after "~".'
                );
            }

            this.parseUnary();
            return;
        }

        this.parsePrimary();
    }

    private parsePrimary(): void {
        if (this.match("ATOM")) {
            return;
        }

        if (this.match("LEFT_PAREN")) {
            if (this.check("RIGHT_PAREN")){
                throw new FormulaSyntaxError (
                    "Empty bracket are not allowed"
                );
            }

            this.parseEquivalent();

            if (!this.match("RIGHT_PAREN")) {
                throw new FormulaSyntaxError(
                    'Missing closing bracket ")".'
                );
            }

            return;
        }

        if (this.check("RIGHT_PAREN")) {
            throw new FormulaSyntaxError(
                'Unexpected closing bracket ")".'
            );
        }

        if (!this.isAtEnd()) {
            const token =this.peek();

            throw new FormulaSyntaxError(
                `Expected a proposition but found "${token.value}".`
            );
        }

        throw new FormulaSyntaxError(
            "Formula is incomplete."
        );
    }

    private requireExpressionAfterOperator(
        operator: string
    ): void {
        if (this.isAtEnd()) {
            throw new FormulaSyntaxError(
                `Expected a proposition after "${operator}".`
            );
        }

        if (this.check("RIGHT_PAREN")) {
            throw new FormulaSyntaxError(
                `Expected a proposition after "${operator}".`
            );
        }
    }

    private match(type: TokenType): boolean {
        if (!this.check(type)) {
            return false;
        }

        this.current++;
        return true;
    }

    private check(type: TokenType): boolean {
        if (this.isAtEnd()) {
            return false;
        }

        return this.peek().type === type;
    }

    private peek(): Token {
        return this.tokens[this.current];
    }

    private previous(): Token {
        return this.tokens[this.current - 1];
    }

    private isAtEnd(): boolean {
        return this.current >= this.tokens.length;
    }

    /* public formular validator */
}

export function  validateFormula(
    formula: string
): ValidationRes {
    const value = formula .trim ();

    if (!value) {
        return {
            valid: false,
            error: "Formula cannot be empty.",
        };
    }

    try {
        const tokens =tokenize(value);

        const parser = new FormulaParser(tokens);
        parser.parse();

        return {
            valid: true,
        };
    } catch (error) {
        if (error instanceof FormulaSyntaxError) {
            return {
                valid: false,
                error: error.message,
            };
        }

        return {
                valid: false,
                error:"invalid formula.",
        };
    }
  }

/* Validate only the logical formulas; annotations are optional plain text. */
export async function validateKBFile(file: File): Promise<UploadedValidationRes> {
    const fail = (error: string): UploadedValidationRes => ({valid: false, errors: [{formula: '', error}]});
    if (!/\.(txt|kb|json)$/i.test(file.name)) return fail('Only .txt, .kb and .json files are supported.');
    if (file.size > 5 * 1024 ** 2) return fail('The uploaded file is larger than 5 MB.');
    try {
        const content = await file.text();
        if (!content.trim()) return fail('The uploaded file is empty.');
        const parsed = parseKBContent(file.name, content);
        if (!parsed.rows.length) return fail('The file contains no formulas.');
        const errors: UploadedFormulaError[] = [];
        parsed.rows.forEach((row, index) => {
            const validation = validateFormula(row.formula);
            if (!validation.valid) errors.push({formula: row.formula, line: row.line, formulaIndex: index + 1, error: validation.error ?? 'Invalid formula.'});
        });
        if (parsed.goal?.trim()) {
            const validation = validateFormula(parsed.goal);
            if (!validation.valid) errors.push({formula: parsed.goal, error: `Goal: ${validation.error ?? 'Invalid formula.'}`});
        }
        return {valid: errors.length === 0, errors};
    } catch (error) {return fail(error instanceof Error ? error.message : 'Could not read the file.');}
}
