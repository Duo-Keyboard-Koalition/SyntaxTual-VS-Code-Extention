import * as vscode from 'vscode';
import { CodeAnalyzer } from '../services/codeAnalyzer';
import { ConversationManager } from '../services/conversationManager';
import { OpenAIService } from '../services/openaiService';
import { Anomaly } from '../models';

interface WebviewMessage {
    type: string;
    payload?: any;
}

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'syntaxtual.chatView';

    private _view?: vscode.WebviewView;
    private _anomalies: Anomaly[] = [];
    private _currentAnomalyId?: string;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _codeAnalyzer: CodeAnalyzer,
        private readonly _conversationManager: ConversationManager,
        private readonly _openaiService: OpenAIService
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist'),
                vscode.Uri.joinPath(this._extensionUri, 'resources')
            ]
        };

        webviewView.webview.html = this._getHtmlContent(webviewView.webview);

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
            await this._handleMessage(message);
        });

        // Send initial state
        this._sendInitialState();
    }

    private async _handleMessage(message: WebviewMessage): Promise<void> {
        switch (message.type) {
            case 'ready':
                this._sendInitialState();
                break;

            case 'analyzeRepository':
                await this._analyzeRepository();
                break;

            case 'analyzeFile':
                await this._analyzeCurrentFile();
                break;

            case 'selectAnomaly':
                await this._selectAnomaly(message.payload?.anomalyId);
                break;

            case 'sendMessage':
                await this._handleChatMessage(message.payload?.content);
                break;

            case 'applyFix':
                await this._applyFix(message.payload?.anomalyId);
                break;

            case 'openFile':
                await this._openFile(message.payload?.file, message.payload?.line);
                break;

            case 'openSettings':
                vscode.commands.executeCommand('workbench.action.openSettings', 'syntaxtual');
                break;
        }
    }

    private async _analyzeRepository(): Promise<void> {
        this._postMessage({ type: 'analysisStarted' });

        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Syntaxtual: Analyzing repository...',
                    cancellable: false
                },
                async (progress) => {
                    const result = await this._codeAnalyzer.analyzeRepository(progress);
                    this._anomalies = result.anomalies;
                    this._postMessage({
                        type: 'analysisComplete',
                        payload: {
                            anomalies: this._serializeAnomalies(result.anomalies),
                            analyzedFiles: result.analyzedFiles.length
                        }
                    });
                }
            );
        } catch (error) {
            this._postMessage({
                type: 'analysisError',
                payload: { error: (error as Error).message }
            });
            vscode.window.showErrorMessage(`Analysis failed: ${(error as Error).message}`);
        }
    }

    private async _analyzeCurrentFile(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No file is currently open');
            return;
        }

        this._postMessage({ type: 'analysisStarted' });

        try {
            const anomalies = await this._codeAnalyzer.analyzeFile(editor.document.uri);
            this._anomalies = anomalies;
            this._postMessage({
                type: 'analysisComplete',
                payload: {
                    anomalies: this._serializeAnomalies(anomalies),
                    analyzedFiles: 1
                }
            });
        } catch (error) {
            this._postMessage({
                type: 'analysisError',
                payload: { error: (error as Error).message }
            });
            vscode.window.showErrorMessage(`Analysis failed: ${(error as Error).message}`);
        }
    }

    private async _selectAnomaly(anomalyId: string): Promise<void> {
        const anomaly = this._anomalies.find(a => a.id === anomalyId);
        if (!anomaly) {
            return;
        }

        this._currentAnomalyId = anomalyId;

        // Start or get existing conversation
        const conversation = await this._conversationManager.startConversation(anomaly);

        // Navigate to the issue in the editor
        const doc = await vscode.workspace.openTextDocument(anomaly.location.file);
        const editor = await vscode.window.showTextDocument(doc);
        editor.revealRange(anomaly.location.range, vscode.TextEditorRevealType.InCenter);
        editor.selection = new vscode.Selection(
            anomaly.location.range.start,
            anomaly.location.range.end
        );

        // Send conversation to webview
        this._postMessage({
            type: 'conversationUpdated',
            payload: {
                anomalyId,
                anomaly: this._serializeAnomaly(anomaly),
                messages: conversation.messages
            }
        });
    }

    private async _handleChatMessage(content: string): Promise<void> {
        if (!this._currentAnomalyId || !content?.trim()) {
            return;
        }

        const anomaly = this._anomalies.find(a => a.id === this._currentAnomalyId);
        if (!anomaly) {
            return;
        }

        this._postMessage({ type: 'chatLoading', payload: { loading: true } });

        try {
            const document = await vscode.workspace.openTextDocument(anomaly.location.file);
            const context = this._conversationManager.buildAnomalyContext(anomaly, document);

            const response = await this._conversationManager.sendMessage(
                this._currentAnomalyId,
                content,
                context
            );

            const conversation = this._conversationManager.getConversation(this._currentAnomalyId);

            this._postMessage({
                type: 'conversationUpdated',
                payload: {
                    anomalyId: this._currentAnomalyId,
                    anomaly: this._serializeAnomaly(anomaly),
                    messages: conversation?.messages || []
                }
            });
        } catch (error) {
            this._postMessage({
                type: 'chatError',
                payload: { error: (error as Error).message }
            });
        } finally {
            this._postMessage({ type: 'chatLoading', payload: { loading: false } });
        }
    }

    private async _applyFix(anomalyId: string): Promise<void> {
        const anomaly = this._anomalies.find(a => a.id === anomalyId);
        if (!anomaly) {
            return;
        }

        try {
            const document = await vscode.workspace.openTextDocument(anomaly.location.file);
            const fix = await this._openaiService.suggestFix(anomaly, document.getText());

            if (!fix) {
                vscode.window.showWarningMessage('Could not generate a fix for this issue');
                return;
            }

            // Apply the fix
            const edit = new vscode.WorkspaceEdit();
            for (const fileEdit of fix.edits) {
                edit.replace(
                    vscode.Uri.file(fileEdit.file),
                    fileEdit.range,
                    fileEdit.newText
                );
            }

            const success = await vscode.workspace.applyEdit(edit);
            if (success) {
                vscode.window.showInformationMessage(`Applied fix: ${fix.description}`);
                // Re-analyze the file
                await this._analyzeCurrentFile();
            } else {
                vscode.window.showErrorMessage('Failed to apply fix');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error applying fix: ${(error as Error).message}`);
        }
    }

    private async _openFile(file: string, line?: number): Promise<void> {
        try {
            const doc = await vscode.workspace.openTextDocument(file);
            const editor = await vscode.window.showTextDocument(doc);

            if (line !== undefined) {
                const position = new vscode.Position(line - 1, 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(
                    new vscode.Range(position, position),
                    vscode.TextEditorRevealType.InCenter
                );
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Could not open file: ${file}`);
        }
    }

    public updateAnomalies(anomalies: Anomaly[]): void {
        this._anomalies = anomalies;
        this._postMessage({
            type: 'anomaliesUpdated',
            payload: { anomalies: this._serializeAnomalies(anomalies) }
        });
    }

    public selectAnomaly(anomalyId: string): void {
        this._selectAnomaly(anomalyId);
    }

    private _sendInitialState(): void {
        const cachedResults = this._codeAnalyzer.getCachedResults();
        if (cachedResults) {
            this._anomalies = cachedResults.anomalies;
        }

        this._postMessage({
            type: 'initialState',
            payload: {
                anomalies: this._serializeAnomalies(this._anomalies),
                isConfigured: this._openaiService.isConfigured()
            }
        });
    }

    private _postMessage(message: WebviewMessage): void {
        this._view?.webview.postMessage(message);
    }

    private _serializeAnomalies(anomalies: Anomaly[]): any[] {
        return anomalies.map(a => this._serializeAnomaly(a));
    }

    private _serializeAnomaly(anomaly: Anomaly): any {
        return {
            id: anomaly.id,
            type: anomaly.type,
            severity: anomaly.severity,
            title: anomaly.title,
            description: anomaly.description,
            suggestion: anomaly.suggestion,
            file: anomaly.location.file,
            startLine: anomaly.location.range.start.line + 1,
            endLine: anomaly.location.range.end.line + 1,
            codeSnippet: anomaly.location.codeSnippet
        };
    }

    private _getHtmlContent(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist', 'index.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist', 'index.css')
        );

        const nonce = this._getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:; font-src ${webview.cspSource};">
    <link href="${styleUri}" rel="stylesheet">
    <title>Syntaxtual</title>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    private _getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
