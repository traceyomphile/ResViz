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

interface AnnotatedFormula {
    formula: string;
    annotation: string | null;
}

function splitAnnotatedFormula(value: string): AnnotatedFormula {
    const trimmed = value.trim();
    const separatorIndex = trimmed.indexOf(":");

    // No annotated - normal prop formula
    if (separatorIndex === -1) {
        return {
            formula: trimmed,
            annotation: null,
        };
    }

    const formula = trimmed.slice(0, separatorIndex).trim();
    const rawAnnotation = trimmed.slice(separatorIndex+1).trim()

    if (!formula) {
        throw new FormulaSyntaxError("A formula is required before the annotation.");
    }

    if (!rawAnnotation) {
        throw new FormulaSyntaxError("An annotation is required after ':'");
    }

    if (!rawAnnotation.startsWith('"') || !rawAnnotation.endsWith('"')) {
        throw new FormulaSyntaxError("Annotation must be enclosed in double quotes.");
    }

    let annotation: string;
    try {
        annotation = JSON.parse(rawAnnotation);
    } catch {
        throw new FormulaSyntaxError("The annotation contains invalid quotation marks.");
    }

    return {
        formula,
        annotation
    };
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

        if (char === "~"){
            tokens.push({
                type: "NOT",
                value: "~",
                pos,
            });

            pos ++;
            continue;
        }

        if (char === "&"){
            tokens.push({
                type: "AND",
                value: "&",
                pos,
            });

            pos++;
            continue;
        }

        if (char === "|"){
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
        const annotated = splitAnnotatedFormula(value)
        // Only the prop logic part goes through the parser.
        const tokens = tokenize(annotated.formula);
        const parser = new FormulaParser(tokens);

        parser.parse();

        return {
            valid: true,
        }
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

/* KB Validation */

function validateTextKB (
    content: string
): UploadedValidationRes {
    const lines = content.split (/\r?\n/);
    const errors: UploadedFormulaError[]=[];

    lines.forEach((line, index) => {
        const formula =line.trim();

        if (!formula) {
            return;
        }

        const validation = validateFormula(formula);

        if (!validation.valid) {
            errors.push({
                line:index+1,
                formula,
                error: validation.error ?? "Invalid formula."
            });
        }
    });

    return {
        valid: errors.length === 0,
        errors,
    };
}

/* validate json file */

function validateJsonKB(
    content: string
): UploadedValidationRes {
    let parsed: unknown;

    try {
        parsed = JSON.parse(content);
    } catch {
        return {
            valid: false,
            errors: [
                {
                    formula: "",
                    error:
                        "The uploaded file is not valid JSON.",
                },
            ],
        };
    }

    let formulas: unknown;
    if (Array.isArray(parsed)) {
        formulas = parsed;
    }
    else if (
        typeof parsed === "object" &&
        parsed !== null
    ) {
        const object =
            parsed as Record<string, unknown>;

        formulas =
            object.formulas ??
            object.knowledgeBase ??
            object.knowledge_base;
    }

    if (!Array.isArray(formulas)) {
        return {
            valid: false,
            errors: [
                {
                    formula: "",
                    error:
                        'The JSON file must contain a "formulas" array.',
                },
            ],
        };
    }   
    
    const errors: UploadedFormulaError[] = [];

    formulas.forEach((item, index) => {
        if (typeof item !== "string") {
            errors.push({
                formulaIndex: index + 1,
                formula: String(item),
                error:
                    "Formula must be written as text.",
            });

            return;
        }

        const formula = item.trim();

        const validation =
            validateFormula(formula);

        if (!validation.valid) {
            errors.push({
                formulaIndex: index + 1,
                formula,
                error:
                    validation.error ??
                    "Invalid formula.",
            });
        }
    });

    return {
        valid: errors.length === 0,
        errors,
    };
}

/* public file validator*/
export async function validateKBFile(
    file: File
): Promise<UploadedValidationRes> {
    const fileName = file.name.toLowerCase();

    const validExtension =
        fileName.endsWith(".txt") ||
        fileName.endsWith(".kb") ||
        fileName.endsWith(".json");

    if (!validExtension) {
        return {
            valid: false,
            errors: [
                {
                    formula: "",
                    error:
                        "Only .txt, .kb and .json files are supported.",
                },
            ],
        };
    }

    const maxFileSize=1024**1024

    if (file.size > maxFileSize){
        return {
            valid: false,
            errors: [
                {
                    formula: "",
                    error:
                        "The uploaded file is larger than 1 MB."
                },
            ],
        };
    }

    const content =await file.text();

    if (!content.trim()) {
        return {
            valid: false,
            errors:[
                {
                    formula:"",
                    error:
                    "The uploaded file is empty."
                },
            ],
        };
    }

    if (fileName.endsWith(".json")) {
        return validateJsonKB(
            content
        );
    }
    return validateTextKB( content );

}