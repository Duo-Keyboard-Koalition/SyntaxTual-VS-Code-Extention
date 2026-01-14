import { Severity } from './anomaly';

export interface ReviewRule {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    severity: Severity;
    pattern?: string;
    prompt?: string;
    languages?: string[];
}

export interface SyntaxtualConfig {
    openaiApiKey: string;
    customEndpoint: string;
    model: string;
    autoAnalyze: boolean;
    customRules: ReviewRule[];
    excludePatterns: string[];
    severityThreshold: Severity;
    maxFilesToAnalyze: number;
}

export interface WorkspaceConfig {
    rules?: ReviewRule[];
    excludePatterns?: string[];
    teamId?: string;
}
