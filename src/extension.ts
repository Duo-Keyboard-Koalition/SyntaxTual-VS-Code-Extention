import * as vscode from 'vscode';
import { ConfigManager } from './config';
import { OpenAIService, CodeAnalyzer, ConversationManager } from './services';
import { DiagnosticsProvider, DecorationsProvider, SidebarProvider } from './providers';
import { DiscordAuthService } from './auth';
import { Anomaly } from './models';

let diagnosticsProvider: DiagnosticsProvider;
let decorationsProvider: DecorationsProvider;
let codeAnalyzer: CodeAnalyzer;
let currentAnomalies: Anomaly[] = [];

export function activate(context: vscode.ExtensionContext): void {
    console.log('Syntaxtual extension is activating...');

    // Initialize services
    const configManager = new ConfigManager();
    const openaiService = new OpenAIService(configManager);
    codeAnalyzer = new CodeAnalyzer(openaiService, configManager);
    const conversationManager = new ConversationManager(openaiService, context);
    const discordAuth = new DiscordAuthService(context);

    // Initialize providers
    diagnosticsProvider = new DiagnosticsProvider();
    decorationsProvider = new DecorationsProvider();

    // Register sidebar webview provider
    const sidebarProvider = new SidebarProvider(
        context.extensionUri,
        codeAnalyzer,
        conversationManager,
        openaiService
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            SidebarProvider.viewType,
            sidebarProvider
        )
    );

    // Register commands
    registerCommands(context, {
        configManager,
        openaiService,
        codeAnalyzer,
        conversationManager,
        diagnosticsProvider,
        decorationsProvider,
        sidebarProvider,
        discordAuth
    });

    // Setup event listeners
    setupEventListeners(context, {
        configManager,
        codeAnalyzer,
        diagnosticsProvider,
        decorationsProvider,
        openaiService
    });

    // Disposables
    context.subscriptions.push(diagnosticsProvider);
    context.subscriptions.push(decorationsProvider);

    console.log('Syntaxtual extension activated successfully');
}

interface CommandServices {
    configManager: ConfigManager;
    openaiService: OpenAIService;
    codeAnalyzer: CodeAnalyzer;
    conversationManager: ConversationManager;
    diagnosticsProvider: DiagnosticsProvider;
    decorationsProvider: DecorationsProvider;
    sidebarProvider: SidebarProvider;
    discordAuth: DiscordAuthService;
}

function registerCommands(context: vscode.ExtensionContext, services: CommandServices): void {
    const {
        configManager,
        openaiService,
        codeAnalyzer,
        conversationManager,
        diagnosticsProvider,
        decorationsProvider,
        sidebarProvider,
        discordAuth
    } = services;

    // Analyze Repository
    context.subscriptions.push(
        vscode.commands.registerCommand('syntaxtual.analyzeRepository', async () => {
            if (!openaiService.isConfigured()) {
                const result = await vscode.window.showWarningMessage(
                    'OpenAI API key not configured. Would you like to set it now?',
                    'Open Settings',
                    'Cancel'
                );
                if (result === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'syntaxtual.openaiApiKey');
                }
                return;
            }

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Syntaxtual: Analyzing repository...',
                    cancellable: false
                },
                async (progress) => {
                    try {
                        const result = await codeAnalyzer.analyzeRepository(progress);
                        currentAnomalies = result.anomalies;

                        // Update providers
                        diagnosticsProvider.updateDiagnostics(result.anomalies);
                        updateActiveEditorDecorations();
                        sidebarProvider.updateAnomalies(result.anomalies);

                        vscode.window.showInformationMessage(
                            `Syntaxtual: Found ${result.anomalies.length} issues in ${result.analyzedFiles.length} files`
                        );
                    } catch (error) {
                        vscode.window.showErrorMessage(`Analysis failed: ${(error as Error).message}`);
                    }
                }
            );
        })
    );

    // Review Current File
    context.subscriptions.push(
        vscode.commands.registerCommand('syntaxtual.reviewFile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No file is currently open');
                return;
            }

            if (!openaiService.isConfigured()) {
                const result = await vscode.window.showWarningMessage(
                    'OpenAI API key not configured. Would you like to set it now?',
                    'Open Settings',
                    'Cancel'
                );
                if (result === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'syntaxtual.openaiApiKey');
                }
                return;
            }

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Syntaxtual: Analyzing file...',
                    cancellable: false
                },
                async () => {
                    try {
                        const anomalies = await codeAnalyzer.analyzeFile(editor.document.uri);

                        // Update current anomalies (add new ones, remove old ones from this file)
                        currentAnomalies = currentAnomalies.filter(
                            a => a.location.file !== editor.document.uri.fsPath
                        );
                        currentAnomalies.push(...anomalies);

                        // Update providers
                        diagnosticsProvider.updateFileDiagnostics(editor.document.uri, anomalies);
                        decorationsProvider.updateDecorations(editor, anomalies);
                        sidebarProvider.updateAnomalies(currentAnomalies);

                        vscode.window.showInformationMessage(
                            `Syntaxtual: Found ${anomalies.length} issues`
                        );
                    } catch (error) {
                        vscode.window.showErrorMessage(`Analysis failed: ${(error as Error).message}`);
                    }
                }
            );
        })
    );

    // Start Conversation
    context.subscriptions.push(
        vscode.commands.registerCommand('syntaxtual.startConversation', async (args?: { anomalyId: string }) => {
            if (args?.anomalyId) {
                sidebarProvider.selectAnomaly(args.anomalyId);
                // Focus the sidebar
                vscode.commands.executeCommand('syntaxtual.chatView.focus');
            } else {
                // If no anomaly specified, focus sidebar to show list
                vscode.commands.executeCommand('syntaxtual.chatView.focus');
            }
        })
    );

    // Apply Fix
    context.subscriptions.push(
        vscode.commands.registerCommand('syntaxtual.applyFix', async (args?: { anomalyId: string }) => {
            if (!args?.anomalyId) {
                return;
            }

            const anomaly = currentAnomalies.find(a => a.id === args.anomalyId);
            if (!anomaly) {
                return;
            }

            try {
                const document = await vscode.workspace.openTextDocument(anomaly.location.file);
                const fix = await openaiService.suggestFix(anomaly, document.getText());

                if (!fix) {
                    vscode.window.showWarningMessage('Could not generate a fix for this issue');
                    return;
                }

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
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Error applying fix: ${(error as Error).message}`);
            }
        })
    );

    // Open Settings
    context.subscriptions.push(
        vscode.commands.registerCommand('syntaxtual.openSettings', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'syntaxtual');
        })
    );

    // Clear Analysis
    context.subscriptions.push(
        vscode.commands.registerCommand('syntaxtual.clearAnalysis', () => {
            currentAnomalies = [];
            codeAnalyzer.clearCache();
            diagnosticsProvider.clearDiagnostics();

            const editor = vscode.window.activeTextEditor;
            if (editor) {
                decorationsProvider.clearDecorations(editor);
            }

            sidebarProvider.updateAnomalies([]);
            vscode.window.showInformationMessage('Syntaxtual: Analysis cleared');
        })
    );

    // Discord Login
    context.subscriptions.push(
        vscode.commands.registerCommand('syntaxtual.loginDiscord', async () => {
            await discordAuth.login();
        })
    );

    // Discord Logout
    context.subscriptions.push(
        vscode.commands.registerCommand('syntaxtual.logout', async () => {
            await discordAuth.logout();
        })
    );
}

interface EventListenerServices {
    configManager: ConfigManager;
    codeAnalyzer: CodeAnalyzer;
    diagnosticsProvider: DiagnosticsProvider;
    decorationsProvider: DecorationsProvider;
    openaiService: OpenAIService;
}

function setupEventListeners(
    context: vscode.ExtensionContext,
    services: EventListenerServices
): void {
    const { configManager, codeAnalyzer, diagnosticsProvider, decorationsProvider, openaiService } = services;

    // Update decorations when active editor changes
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                const fileAnomalies = currentAnomalies.filter(
                    a => a.location.file === editor.document.uri.fsPath
                );
                decorationsProvider.updateDecorations(editor, fileAnomalies);
            }
        })
    );

    // Auto-analyze on save if enabled
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            if (!configManager.autoAnalyze) {
                return;
            }

            if (!openaiService.isConfigured()) {
                return;
            }

            // Check if file should be excluded
            const excludePatterns = configManager.excludePatterns;
            const relativePath = vscode.workspace.asRelativePath(document.uri);

            for (const pattern of excludePatterns) {
                if (new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')).test(relativePath)) {
                    return;
                }
            }

            try {
                const anomalies = await codeAnalyzer.analyzeFile(document.uri);

                // Update current anomalies
                currentAnomalies = currentAnomalies.filter(
                    a => a.location.file !== document.uri.fsPath
                );
                currentAnomalies.push(...anomalies);

                // Update providers
                diagnosticsProvider.updateFileDiagnostics(document.uri, anomalies);

                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document.uri.fsPath === document.uri.fsPath) {
                    decorationsProvider.updateDecorations(editor, anomalies);
                }
            } catch (error) {
                console.error('Auto-analyze error:', error);
            }
        })
    );

    // Refresh OpenAI client when config changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('syntaxtual.openaiApiKey')) {
                openaiService.refreshClient();
            }
        })
    );
}

function updateActiveEditorDecorations(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor && decorationsProvider) {
        const fileAnomalies = currentAnomalies.filter(
            a => a.location.file === editor.document.uri.fsPath
        );
        decorationsProvider.updateDecorations(editor, fileAnomalies);
    }
}

export function deactivate(): void {
    console.log('Syntaxtual extension deactivated');
}
