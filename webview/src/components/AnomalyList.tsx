interface Anomaly {
  id: string;
  type: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  suggestion?: string;
  file: string;
  startLine: number;
  endLine: number;
  codeSnippet?: string;
}

interface AnomalyListProps {
  anomalies: Anomaly[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenFile: (file: string, line?: number) => void;
  onAnalyzeRepository: () => void;
  onAnalyzeFile: () => void;
}

export function AnomalyList({
  anomalies,
  selectedId,
  onSelect,
  onOpenFile,
  onAnalyzeRepository,
  onAnalyzeFile
}: AnomalyListProps) {
  if (anomalies.length === 0) {
    return (
      <div className="empty-state">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
        <p>No issues found!</p>
        <p>Your code looks good.</p>
        <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexDirection: 'column' }}>
          <button className="btn btn-secondary" onClick={onAnalyzeFile}>
            Analyze Current File
          </button>
          <button className="btn btn-secondary" onClick={onAnalyzeRepository}>
            Analyze Repository
          </button>
        </div>
      </div>
    );
  }

  // Group anomalies by file
  const groupedAnomalies = anomalies.reduce((acc, anomaly) => {
    const fileName = anomaly.file.split(/[/\\]/).pop() || anomaly.file;
    if (!acc[fileName]) {
      acc[fileName] = [];
    }
    acc[fileName].push(anomaly);
    return acc;
  }, {} as Record<string, Anomaly[]>);

  return (
    <div className="anomaly-list">
      <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
        <button className="btn btn-secondary" onClick={onAnalyzeFile} style={{ flex: 1 }}>
          Analyze File
        </button>
        <button className="btn btn-secondary" onClick={onAnalyzeRepository} style={{ flex: 1 }}>
          Analyze Repo
        </button>
      </div>

      {Object.entries(groupedAnomalies).map(([fileName, fileAnomalies]) => (
        <div key={fileName}>
          <div style={{
            fontSize: '11px',
            color: 'var(--vscode-descriptionForeground)',
            marginBottom: '4px',
            marginTop: '8px'
          }}>
            {fileName} ({fileAnomalies.length})
          </div>
          {fileAnomalies.map(anomaly => (
            <AnomalyCard
              key={anomaly.id}
              anomaly={anomaly}
              isSelected={selectedId === anomaly.id}
              onSelect={() => onSelect(anomaly.id)}
              onOpenFile={() => onOpenFile(anomaly.file, anomaly.startLine)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface AnomalyCardProps {
  anomaly: Anomaly;
  isSelected: boolean;
  onSelect: () => void;
  onOpenFile: () => void;
}

function AnomalyCard({ anomaly, isSelected, onSelect, onOpenFile }: AnomalyCardProps) {
  const handleClick = () => {
    onSelect();
  };

  const handleLocationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenFile();
  };

  return (
    <div
      className={`anomaly-card ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
    >
      <div className="anomaly-header">
        <span className={`severity-badge ${anomaly.severity}`}>
          {anomaly.severity}
        </span>
        <span className="anomaly-title">{anomaly.title}</span>
      </div>
      <div className="anomaly-description">
        {anomaly.description.length > 100
          ? anomaly.description.slice(0, 100) + '...'
          : anomaly.description}
      </div>
      <div
        className="anomaly-location"
        onClick={handleLocationClick}
        style={{ cursor: 'pointer' }}
      >
        Line {anomaly.startLine}
        {anomaly.endLine !== anomaly.startLine && ` - ${anomaly.endLine}`}
      </div>
    </div>
  );
}
