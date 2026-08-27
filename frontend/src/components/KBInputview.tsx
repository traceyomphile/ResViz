import {useRef,useState} from "react";
import type {InputMethod, KBData} from "../types";

interface KBInputViewProps{
    method: InputMethod;
    projectName:string| null;
    formulas: string;
    goal:string;
    upload:KBData | null;
    isUploading:boolean;
}