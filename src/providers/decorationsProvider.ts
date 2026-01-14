import * as vscode from 'vscode';
import { Anomaly } from '../models';

export class DecorationsProvider {
    private errorDecorationType: vscode.TextEditorDecorationType;
    private warningDecorationType: vscode.TextEditorDecorationType;
    private infoDecorationType: vscode.TextEditorDecorationType;

    constructor() {
        this.errorDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 82, 82, 0.15)',
            borderWidth: '0 0 2px 0',
            borderStyle: 'solid',
            borderColor: '#ff5252',
            isWholeLine: true,
            overviewRulerColor: '#ff5252',
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            after: {
                margin: '0 0 0 2em',
                color: 'rgba(255, 82, 82, 0.7)',
                fontStyle: 'italic',
                fontWeight: 'normal'
            }
        });

        this.warningDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 193, 7, 0.15)',
            borderWidth: '0 0 2px 0',
            borderStyle: 'solid',
            borderColor: '#ffc107',
            isWholeLine: true,
            overviewRulerColor: '#ffc107',
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            after: {
                margin: '0 0 0 2em',
                color: 'rgba(255, 193, 7, 0.7)',
                fontStyle: 'italic',
                fontWeight: 'normal'
            }
        });

        this.infoDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            borderWidth: '0 0 1px 0',
            borderStyle: 'dashed',
            borderColor: 'rgba(33, 150, 243, 0.5)',
            isWholeLine: true,
            overviewRulerColor: '#2196f3',
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            after: {
                margin: '0 0 0 2em',
                color: 'rgba(33, 150, 243, 0.6)',
                fontStyle: 'italic',
                fontWeight: 'normal'
            }
        });
    }

    updateDecorations(editor: vscode.TextEditor, anomalies: Anomaly[]): void {
        const errors: vscode.DecorationOptions[] = [];
        const warnings: vscode.DecorationOptions[] = [];
        const infos: vscode.DecorationOptions[] = [];

        for (const anomaly of anomalies) {
            if (anomaly.location.file !== editor.document.uri.fsPath) {
                continue;
            }

            const decoration = this.createDecoration(anomaly);

            switch (anomaly.severity) {
                case 'error':
                    errors.push(decoration);
                    break;
                case 'warning':
                    warnings.push(decoration);
                    break;
                case 'info':
                    infos.push(decoration);
                    break;
            }
        }

        editor.setDecorations(this.errorDecorationType, errors);
        editor.setDecorations(this.warningDecorationType, warnings);
        editor.setDecorations(this.infoDecorationType, infos);
    }

    clearDecorations(editor: vscode.TextEditor): void {
        editor.setDecorations(this.errorDecorationType, []);
        editor.setDecorations(this.warningDecorationType, []);
        editor.setDecorations(this.infoDecorationType, []);
    }

    private createDecoration(anomaly: Anomaly): vscode.DecorationOptions {
        const hoverMessage = new vscode.MarkdownString();
        hoverMessage.isTrusted = true;
        hoverMessage.supportHtml = true;

        hoverMessage.appendMarkdown(`### ${this.getSeverityIcon(anomaly.severity)} ${anomaly.title}\n\n`);
        hoverMessage.appendMarkdown(`${anomaly.description}\n\n`);

        if (anomaly.suggestion) {
            hoverMessage.appendMarkdown(`**Suggestion:** ${anomaly.suggestion}\n\n`);
        }

        hoverMessage.appendMarkdown(`---\n`);
        hoverMessage.appendMarkdown(`[Discuss this issue](command:syntaxtual.startConversation?${encodeURIComponent(JSON.stringify({ anomalyId: anomaly.id }))})`);

        return {
            range: anomaly.location.range,
            hoverMessage,
            renderOptions: {
                after: {
                    contentText: ` ${anomaly.title}`
                }
            }
        };
    }

    private getSeverityIcon(severity: string): string {
        switch (severity) {
            case 'error':
                return '$(error)';
            case 'warning':
                return '$(warning)';
            case 'info':
            default:
                return '$(info)';
        }
    }

    dispose(): void {
        this.errorDecorationType.dispose();
        this.warningDecorationType.dispose();
        this.infoDecorationType.dispose();
    }
}
