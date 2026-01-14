import OpenAI from 'openai';
import { ConfigManager } from '../config';
import { Anomaly, AnomalyType, ReviewRule, Message, AnomalyContext, CodeFix, Severity } from '../models';
import { DEFAULT_RULES } from '../config/defaultRules';

interface AnalysisContext {
    fileName: string;
    language: string;
    content: string;
    relatedFiles?: Array<{ name: string; content: string }>;
}

interface AIAnomaly {
    type: string;
    severity: string;
    startLine: number;
    endLine: number;
    title: string;
    description: string;
    suggestion?: string;
}

interface AnalysisResponse {
    anomalies: AIAnomaly[];
}

export class OpenAIService {
    private client: OpenAI | null = null;
    private configManager: ConfigManager;

    constructor(configManager: ConfigManager) {
        this.configManager = configManager;
        this.initializeClient();
    }

    private initializeClient(): void {
        const apiKey = this.configManager.openaiApiKey;
        if (apiKey) {
            this.client = new OpenAI({ apiKey });
        }
    }

    public refreshClient(): void {
        this.initializeClient();
    }

    public isConfigured(): boolean {
        return this.client !== null && this.configManager.isApiKeyConfigured();
    }

    async analyze(
        context: AnalysisContext,
        customRules?: ReviewRule[]
    ): Promise<Anomaly[]> {
        if (!this.client) {
            throw new Error('OpenAI API key not configured');
        }

        const rules = customRules || DEFAULT_RULES.filter(r => r.enabled);
        const systemPrompt = this.buildAnalysisSystemPrompt(rules);
        const userPrompt = this.buildAnalysisUserPrompt(context);

        try {
            const response = await this.client.chat.completions.create({
                model: this.configManager.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.3,
                response_format: { type: 'json_object' }
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                return [];
            }

            const result = JSON.parse(content) as AnalysisResponse;
            return this.parseAnomalies(result.anomalies, context.fileName, context.content);
        } catch (error) {
            console.error('OpenAI analysis error:', error);
            throw error;
        }
    }

    async chat(messages: Message[], anomalyContext: AnomalyContext): Promise<string> {
        if (!this.client) {
            throw new Error('OpenAI API key not configured');
        }

        const systemPrompt = this.buildChatSystemPrompt(anomalyContext);

        try {
            const response = await this.client.chat.completions.create({
                model: this.configManager.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...messages.map(m => ({
                        role: m.role as 'user' | 'assistant',
                        content: m.content
                    }))
                ],
                temperature: 0.7
            });

            return response.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
        } catch (error) {
            console.error('OpenAI chat error:', error);
            throw error;
        }
    }

    async suggestFix(anomaly: Anomaly, fileContent: string): Promise<CodeFix | null> {
        if (!this.client) {
            throw new Error('OpenAI API key not configured');
        }

        const systemPrompt = `You are a code fixing assistant. Given a code issue and the file content, suggest a specific fix.
Return a JSON object with:
- description: Brief description of the fix
- newCode: The corrected code that should replace the problematic section

Be precise and only fix the specific issue mentioned.`;

        const userPrompt = `Issue: ${anomaly.title}
Description: ${anomaly.description}
File: ${anomaly.location.file}
Lines: ${anomaly.location.range.start.line + 1}-${anomaly.location.range.end.line + 1}

Code snippet with issue:
\`\`\`
${anomaly.location.codeSnippet || 'N/A'}
\`\`\`

Full file content:
\`\`\`
${fileContent}
\`\`\`

Suggest a fix for this specific issue.`;

        try {
            const response = await this.client.chat.completions.create({
                model: this.configManager.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.3,
                response_format: { type: 'json_object' }
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                return null;
            }

            const result = JSON.parse(content) as { description: string; newCode: string };
            return {
                description: result.description,
                edits: [{
                    file: anomaly.location.file,
                    range: anomaly.location.range,
                    newText: result.newCode
                }]
            };
        } catch (error) {
            console.error('OpenAI fix suggestion error:', error);
            return null;
        }
    }

    private buildAnalysisSystemPrompt(rules: ReviewRule[]): string {
        const ruleDescriptions = rules
            .map(r => `- ${r.name}: ${r.prompt || r.description}`)
            .join('\n');

        return `You are an expert code reviewer. Analyze the provided code and identify issues based on these rules:

${ruleDescriptions}

Return a JSON object with an "anomalies" array. Each anomaly should have:
- type: One of: potential_bug, security_issue, performance, code_smell, best_practice, logic_error, type_mismatch, unused_code, complexity, naming_convention
- severity: One of: error, warning, info
- startLine: Line number where the issue starts (1-indexed)
- endLine: Line number where the issue ends (1-indexed)
- title: Brief title of the issue (max 50 chars)
- description: Detailed explanation of the issue
- suggestion: How to fix the issue (optional)

Be thorough but avoid false positives. Only report actual issues.`;
    }

    private buildAnalysisUserPrompt(context: AnalysisContext): string {
        let prompt = `Analyze this ${context.language} file: ${context.fileName}

\`\`\`${context.language}
${context.content}
\`\`\``;

        if (context.relatedFiles && context.relatedFiles.length > 0) {
            prompt += '\n\nRelated files for context:\n';
            for (const file of context.relatedFiles) {
                prompt += `\n${file.name}:\n\`\`\`\n${file.content.slice(0, 2000)}\n\`\`\`\n`;
            }
        }

        return prompt;
    }

    private buildChatSystemPrompt(context: AnomalyContext): string {
        return `You are a helpful code review assistant discussing a specific code issue with a developer.

Context about the issue:
- File: ${context.file}
- Lines: ${context.range.start}-${context.range.end}
- Language: ${context.language}
- Issue Type: ${context.anomaly.type}
- Issue: ${context.anomaly.title}
- Description: ${context.anomaly.description}

Code snippet:
\`\`\`${context.language}
${context.codeSnippet}
\`\`\`

Help the developer understand and fix this issue through conversational dialogue. Be concise, helpful, and provide code examples when relevant.`;
    }

    private parseAnomalies(aiAnomalies: AIAnomaly[], fileName: string, content: string): Anomaly[] {
        const lines = content.split('\n');

        return aiAnomalies.map((a, index) => {
            const startLine = Math.max(0, a.startLine - 1);
            const endLine = Math.min(lines.length - 1, a.endLine - 1);

            const codeSnippet = lines.slice(startLine, endLine + 1).join('\n');

            // Import vscode dynamically to avoid issues
            const vscode = require('vscode');

            return {
                id: `${fileName}-${index}-${Date.now()}`,
                type: this.mapAnomalyType(a.type),
                severity: this.mapSeverity(a.severity),
                location: {
                    file: fileName,
                    range: new vscode.Range(startLine, 0, endLine, lines[endLine]?.length || 0),
                    codeSnippet
                },
                title: a.title,
                description: a.description,
                suggestion: a.suggestion
            };
        });
    }

    private mapAnomalyType(type: string): AnomalyType {
        const typeMap: Record<string, AnomalyType> = {
            'potential_bug': AnomalyType.POTENTIAL_BUG,
            'security_issue': AnomalyType.SECURITY_ISSUE,
            'performance': AnomalyType.PERFORMANCE,
            'code_smell': AnomalyType.CODE_SMELL,
            'best_practice': AnomalyType.BEST_PRACTICE,
            'logic_error': AnomalyType.LOGIC_ERROR,
            'type_mismatch': AnomalyType.TYPE_MISMATCH,
            'unused_code': AnomalyType.UNUSED_CODE,
            'complexity': AnomalyType.COMPLEXITY,
            'naming_convention': AnomalyType.NAMING_CONVENTION
        };
        return typeMap[type] || AnomalyType.CODE_SMELL;
    }

    private mapSeverity(severity: string): Severity {
        const severityMap: Record<string, Severity> = {
            'error': 'error',
            'warning': 'warning',
            'info': 'info'
        };
        return severityMap[severity] || 'info';
    }
}
