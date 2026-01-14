import * as vscode from 'vscode';
import { ConfigManager } from '../config';
import { OpenAIService } from './openaiService';
import { Anomaly, AnalysisResult, ReviewRule } from '../models';
import { DEFAULT_RULES } from '../config/defaultRules';

interface FileInfo {
    uri: vscode.Uri;
    content: string;
    language: string;
}

export class CodeAnalyzer {
    private openaiService: OpenAIService;
    private configManager: ConfigManager;
    private analysisCache: Map<string, AnalysisResult> = new Map();

    constructor(openaiService: OpenAIService, configManager: ConfigManager) {
        this.openaiService = openaiService;
        this.configManager = configManager;
    }

    async analyzeFile(uri: vscode.Uri): Promise<Anomaly[]> {
        if (!this.openaiService.isConfigured()) {
            throw new Error('OpenAI API key not configured. Please set it in settings.');
        }

        const document = await vscode.workspace.openTextDocument(uri);
        const content = document.getText();
        const language = document.languageId;
        const fileName = uri.fsPath;

        // Get related files for context
        const relatedFiles = await this.getRelatedFiles(uri, content);

        // Get merged rules
        const rules = await this.configManager.getMergedRules();
        const enabledRules = rules.length > 0
            ? rules.filter(r => r.enabled)
            : DEFAULT_RULES.filter(r => r.enabled);

        const anomalies = await this.openaiService.analyze(
            {
                fileName,
                language,
                content,
                relatedFiles: relatedFiles.map(f => ({
                    name: f.uri.fsPath,
                    content: f.content
                }))
            },
            enabledRules
        );

        // Filter by severity threshold
        const threshold = this.configManager.severityThreshold;
        const filteredAnomalies = this.filterBySeverity(anomalies, threshold);

        // Cache results
        this.analysisCache.set(uri.fsPath, {
            anomalies: filteredAnomalies,
            analyzedFiles: [uri.fsPath],
            timestamp: Date.now()
        });

        return filteredAnomalies;
    }

    async analyzeRepository(
        progress?: vscode.Progress<{ message?: string; increment?: number }>
    ): Promise<AnalysisResult> {
        if (!this.openaiService.isConfigured()) {
            throw new Error('OpenAI API key not configured. Please set it in settings.');
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder open');
        }

        // Get all files to analyze
        const files = await this.getFilesToAnalyze(workspaceFolder.uri);
        const maxFiles = this.configManager.maxFilesToAnalyze;
        const filesToProcess = files.slice(0, maxFiles);

        const allAnomalies: Anomaly[] = [];
        const analyzedFiles: string[] = [];
        const increment = 100 / filesToProcess.length;

        for (let i = 0; i < filesToProcess.length; i++) {
            const file = filesToProcess[i];
            progress?.report({
                message: `Analyzing ${file.uri.fsPath.split(/[/\\]/).pop()}...`,
                increment
            });

            try {
                const anomalies = await this.analyzeFile(file.uri);
                allAnomalies.push(...anomalies);
                analyzedFiles.push(file.uri.fsPath);
            } catch (error) {
                console.error(`Error analyzing ${file.uri.fsPath}:`, error);
            }
        }

        const result: AnalysisResult = {
            anomalies: allAnomalies,
            analyzedFiles,
            timestamp: Date.now()
        };

        return result;
    }

    getCachedResults(uri?: vscode.Uri): AnalysisResult | null {
        if (uri) {
            return this.analysisCache.get(uri.fsPath) || null;
        }

        // Return all cached results combined
        const allAnomalies: Anomaly[] = [];
        const allFiles: string[] = [];

        for (const result of this.analysisCache.values()) {
            allAnomalies.push(...result.anomalies);
            allFiles.push(...result.analyzedFiles);
        }

        if (allAnomalies.length === 0) {
            return null;
        }

        return {
            anomalies: allAnomalies,
            analyzedFiles: allFiles,
            timestamp: Date.now()
        };
    }

    clearCache(uri?: vscode.Uri): void {
        if (uri) {
            this.analysisCache.delete(uri.fsPath);
        } else {
            this.analysisCache.clear();
        }
    }

    private async getFilesToAnalyze(workspaceUri: vscode.Uri): Promise<FileInfo[]> {
        const excludePatterns = this.configManager.excludePatterns;
        const excludeGlob = `{${excludePatterns.join(',')}}`;

        // Find all code files
        const codeExtensions = [
            '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
            '**/*.py', '**/*.java', '**/*.go', '**/*.rs',
            '**/*.c', '**/*.cpp', '**/*.cs', '**/*.rb',
            '**/*.php', '**/*.swift', '**/*.kt'
        ];

        const files: FileInfo[] = [];

        for (const pattern of codeExtensions) {
            const uris = await vscode.workspace.findFiles(
                new vscode.RelativePattern(workspaceUri, pattern),
                excludeGlob,
                this.configManager.maxFilesToAnalyze
            );

            for (const uri of uris) {
                try {
                    const document = await vscode.workspace.openTextDocument(uri);
                    files.push({
                        uri,
                        content: document.getText(),
                        language: document.languageId
                    });
                } catch (error) {
                    // Skip files that can't be read
                }
            }

            if (files.length >= this.configManager.maxFilesToAnalyze) {
                break;
            }
        }

        return files;
    }

    private async getRelatedFiles(uri: vscode.Uri, content: string): Promise<FileInfo[]> {
        const relatedFiles: FileInfo[] = [];
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);

        if (!workspaceFolder) {
            return relatedFiles;
        }

        // Extract imports from the file
        const importPatterns = [
            /import\s+.*?\s+from\s+['"](.+?)['"]/g,  // ES imports
            /require\s*\(\s*['"](.+?)['"]\s*\)/g,    // CommonJS requires
            /from\s+(\S+)\s+import/g                  // Python imports
        ];

        const imports: string[] = [];
        for (const pattern of importPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                imports.push(match[1]);
            }
        }

        // Resolve and read related files (limit to 3)
        const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', ''];
        let count = 0;

        for (const imp of imports) {
            if (count >= 3) break;
            if (imp.startsWith('.')) {
                const basePath = vscode.Uri.joinPath(uri, '..', imp);

                for (const ext of extensions) {
                    try {
                        const fullPath = vscode.Uri.file(basePath.fsPath + ext);
                        const doc = await vscode.workspace.openTextDocument(fullPath);
                        relatedFiles.push({
                            uri: fullPath,
                            content: doc.getText().slice(0, 3000), // Limit content
                            language: doc.languageId
                        });
                        count++;
                        break;
                    } catch {
                        // Try next extension
                    }
                }
            }
        }

        return relatedFiles;
    }

    private filterBySeverity(anomalies: Anomaly[], threshold: string): Anomaly[] {
        const severityOrder = { 'error': 0, 'warning': 1, 'info': 2 };
        const thresholdLevel = severityOrder[threshold as keyof typeof severityOrder] ?? 2;

        return anomalies.filter(a => {
            const anomalyLevel = severityOrder[a.severity as keyof typeof severityOrder] ?? 2;
            return anomalyLevel <= thresholdLevel;
        });
    }
}
