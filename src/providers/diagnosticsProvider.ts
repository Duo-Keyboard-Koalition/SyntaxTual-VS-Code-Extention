import * as vscode from 'vscode';
import { Anomaly } from '../models';

export class DiagnosticsProvider {
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('syntaxtual');
    }

    updateDiagnostics(anomalies: Anomaly[]): void {
        // Clear all existing diagnostics
        this.diagnosticCollection.clear();

        // Group anomalies by file
        const anomaliesByFile = new Map<string, Anomaly[]>();

        for (const anomaly of anomalies) {
            const file = anomaly.location.file;
            if (!anomaliesByFile.has(file)) {
                anomaliesByFile.set(file, []);
            }
            anomaliesByFile.get(file)!.push(anomaly);
        }

        // Create diagnostics for each file
        for (const [file, fileAnomalies] of anomaliesByFile) {
            const diagnostics = fileAnomalies.map(anomaly => this.createDiagnostic(anomaly));
            this.diagnosticCollection.set(vscode.Uri.file(file), diagnostics);
        }
    }

    updateFileDiagnostics(uri: vscode.Uri, anomalies: Anomaly[]): void {
        const diagnostics = anomalies
            .filter(a => a.location.file === uri.fsPath)
            .map(a => this.createDiagnostic(a));

        this.diagnosticCollection.set(uri, diagnostics);
    }

    clearDiagnostics(uri?: vscode.Uri): void {
        if (uri) {
            this.diagnosticCollection.delete(uri);
        } else {
            this.diagnosticCollection.clear();
        }
    }

    private createDiagnostic(anomaly: Anomaly): vscode.Diagnostic {
        const diagnostic = new vscode.Diagnostic(
            anomaly.location.range,
            `${anomaly.title}: ${anomaly.description}`,
            this.mapSeverity(anomaly.severity)
        );

        diagnostic.source = 'Syntaxtual';
        diagnostic.code = {
            value: anomaly.type,
            target: vscode.Uri.parse(
                `command:syntaxtual.startConversation?${encodeURIComponent(JSON.stringify({ anomalyId: anomaly.id }))}`
            )
        };

        // Add related information if available
        if (anomaly.relatedLocations && anomaly.relatedLocations.length > 0) {
            diagnostic.relatedInformation = anomaly.relatedLocations.map(loc =>
                new vscode.DiagnosticRelatedInformation(
                    new vscode.Location(
                        vscode.Uri.file(loc.file),
                        loc.range
                    ),
                    loc.message
                )
            );
        }

        return diagnostic;
    }

    private mapSeverity(severity: string): vscode.DiagnosticSeverity {
        switch (severity) {
            case 'error':
                return vscode.DiagnosticSeverity.Error;
            case 'warning':
                return vscode.DiagnosticSeverity.Warning;
            case 'info':
            default:
                return vscode.DiagnosticSeverity.Information;
        }
    }

    dispose(): void {
        this.diagnosticCollection.dispose();
    }
}
