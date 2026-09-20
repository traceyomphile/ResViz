export interface KBData{
    fileName:string;
    formulas:string[];
    goal:string;
}

export type InputMethod = "upload" |"type";
export type Screen ="splash"|"project"| "kb-choice" | "kb-input" ;