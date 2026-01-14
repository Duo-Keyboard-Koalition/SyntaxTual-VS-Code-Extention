interface WelcomePanelProps {
  isConfigured: boolean;
  onAnalyzeRepository: () => void;
  onAnalyzeFile: () => void;
  onOpenSettings: () => void;
}

export function WelcomePanel({
  isConfigured,
  onAnalyzeRepository,
  onAnalyzeFile,
  onOpenSettings
}: WelcomePanelProps) {
  return (
    <div className="welcome-panel">
      <h2>Syntaxtual</h2>
      <p>AI-powered code review assistant</p>

      {!isConfigured ? (
        <>
          <p style={{ color: 'var(--vscode-errorForeground)' }}>
            OpenAI API key not configured
          </p>
          <div className="action-buttons">
            <button className="btn btn-primary" onClick={onOpenSettings}>
              Configure API Key
            </button>
          </div>
        </>
      ) : (
        <div className="action-buttons">
          <button className="btn btn-primary" onClick={onAnalyzeFile}>
            Analyze Current File
          </button>
          <button className="btn btn-secondary" onClick={onAnalyzeRepository}>
            Analyze Repository
          </button>
        </div>
      )}
    </div>
  );
}
