import * as vscode from 'vscode';
import { SyntaxtualConfig, ReviewRule, Severity, WorkspaceConfig } from '../models';

export class ConfigManager {
    private config: vscode.WorkspaceConfiguration;

    constructor() {
        this.config = vscode.workspace.getConfiguration('syntaxtual');

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('syntaxtual')) {
                this.config = vscode.workspace.getConfiguration('syntaxtual');
            }
        });
    }

    get openaiApiKey(): string {
        return this.config.get<string>('openaiApiKey', '');
    }

    get model(): string {
        return this.config.get<string>('model', 'gpt-4-turbo-preview');
    }

    get autoAnalyze(): boolean {
        return this.config.get<boolean>('autoAnalyze', false);
    }

    get customRules(): ReviewRule[] {
        return this.config.get<ReviewRule[]>('customRules', []);
    }

    get excludePatterns(): string[] {
        return this.config.get<string[]>('excludePatterns', [
            '**/node_modules/**',
            '**/dist/**',
            '**/.git/**'
        ]);
    }

    get severityThreshold(): Severity {
        return this.config.get<Severity>('severityThreshold', 'info');
    }

    get maxFilesToAnalyze(): number {
        return this.config.get<number>('maxFilesToAnalyze', 50);
    }

    async set<K extends keyof SyntaxtualConfig>(
        key: K,
        value: SyntaxtualConfig[K]
    ): Promise<void> {
        await this.config.update(key, value, vscode.ConfigurationTarget.Global);
    }

    async loadWorkspaceConfig(): Promise<WorkspaceConfig | null> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return null;
        }

        const configUri = vscode.Uri.joinPath(workspaceFolder.uri, '.syntaxtual.json');
        try {
            const content = await vscode.workspace.fs.readFile(configUri);
            return JSON.parse(content.toString()) as WorkspaceConfig;
        } catch {
            return null;
        }
    }

    async getMergedRules(): Promise<ReviewRule[]> {
        const userRules = this.customRules;
        const workspaceConfig = await this.loadWorkspaceConfig();
        const workspaceRules = workspaceConfig?.rules || [];

        // Merge rules, user rules take precedence for same ID
        const ruleMap = new Map<string, ReviewRule>();

        for (const rule of workspaceRules) {
            ruleMap.set(rule.id, rule);
        }

        for (const rule of userRules) {
            ruleMap.set(rule.id, rule);
        }

        return Array.from(ruleMap.values());
    }

    getFullConfig(): SyntaxtualConfig {
        return {
            openaiApiKey: this.openaiApiKey,
            model: this.model,
            autoAnalyze: this.autoAnalyze,
            customRules: this.customRules,
            excludePatterns: this.excludePatterns,
            severityThreshold: this.severityThreshold,
            maxFilesToAnalyze: this.maxFilesToAnalyze
        };
    }

    isApiKeyConfigured(): boolean {
        return this.openaiApiKey.length > 0;
    }
}
