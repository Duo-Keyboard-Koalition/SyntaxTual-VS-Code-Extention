import * as vscode from 'vscode';

export enum AnomalyType {
    POTENTIAL_BUG = 'potential_bug',
    SECURITY_ISSUE = 'security_issue',
    PERFORMANCE = 'performance',
    CODE_SMELL = 'code_smell',
    BEST_PRACTICE = 'best_practice',
    LOGIC_ERROR = 'logic_error',
    TYPE_MISMATCH = 'type_mismatch',
    UNUSED_CODE = 'unused_code',
    COMPLEXITY = 'complexity',
    NAMING_CONVENTION = 'naming_convention'
}

export type Severity = 'error' | 'warning' | 'info';

export interface AnomalyLocation {
    file: string;
    range: vscode.Range;
    codeSnippet?: string;
}

export interface RelatedLocation {
    file: string;
    range: vscode.Range;
    message: string;
}

export interface Anomaly {
    id: string;
    type: AnomalyType;
    severity: Severity;
    location: AnomalyLocation;
    title: string;
    description: string;
    suggestion?: string;
    relatedLocations?: RelatedLocation[];
    conversationId?: string;
    fix?: CodeFix;
}

export interface CodeFix {
    description: string;
    edits: FileEdit[];
}

export interface FileEdit {
    file: string;
    range: vscode.Range;
    newText: string;
}

export interface AnalysisResult {
    anomalies: Anomaly[];
    analyzedFiles: string[];
    timestamp: number;
}
