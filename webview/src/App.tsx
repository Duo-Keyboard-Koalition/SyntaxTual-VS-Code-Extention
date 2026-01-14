import { useState, useEffect, useCallback } from 'react';
import { useVSCodeApi } from './hooks/useVSCodeApi';
import { AnomalyList } from './components/AnomalyList';
import { ChatPanel } from './components/ChatPanel';
import { WelcomePanel } from './components/WelcomePanel';

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

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ConversationState {
  anomalyId: string;
  anomaly: Anomaly;
  messages: Message[];
}

type TabType = 'issues' | 'chat';

function App() {
  const { postMessage } = useVSCodeApi();
  const [activeTab, setActiveTab] = useState<TabType>('issues');
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationState | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, payload } = event.data;

      switch (type) {
        case 'initialState':
          setAnomalies(payload.anomalies || []);
          setIsConfigured(payload.isConfigured);
          break;

        case 'analysisStarted':
          setIsAnalyzing(true);
          setError(null);
          break;

        case 'analysisComplete':
          setIsAnalyzing(false);
          setAnomalies(payload.anomalies || []);
          break;

        case 'analysisError':
          setIsAnalyzing(false);
          setError(payload.error);
          break;

        case 'anomaliesUpdated':
          setAnomalies(payload.anomalies || []);
          break;

        case 'conversationUpdated':
          setConversation({
            anomalyId: payload.anomalyId,
            anomaly: payload.anomaly,
            messages: payload.messages
          });
          setActiveTab('chat');
          break;

        case 'chatLoading':
          setIsChatLoading(payload.loading);
          break;

        case 'chatError':
          setError(payload.error);
          setIsChatLoading(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // Signal that we're ready
    postMessage('ready');

    return () => window.removeEventListener('message', handleMessage);
  }, [postMessage]);

  const handleAnalyzeRepository = useCallback(() => {
    postMessage('analyzeRepository');
  }, [postMessage]);

  const handleAnalyzeFile = useCallback(() => {
    postMessage('analyzeFile');
  }, [postMessage]);

  const handleSelectAnomaly = useCallback((anomalyId: string) => {
    setSelectedAnomalyId(anomalyId);
    postMessage('selectAnomaly', { anomalyId });
  }, [postMessage]);

  const handleSendMessage = useCallback((content: string) => {
    if (!content.trim()) return;
    postMessage('sendMessage', { content });
  }, [postMessage]);

  const handleApplyFix = useCallback((anomalyId: string) => {
    postMessage('applyFix', { anomalyId });
  }, [postMessage]);

  const handleOpenFile = useCallback((file: string, line?: number) => {
    postMessage('openFile', { file, line });
  }, [postMessage]);

  const handleOpenSettings = useCallback(() => {
    postMessage('openSettings');
  }, [postMessage]);

  const handleBackToList = useCallback(() => {
    setActiveTab('issues');
  }, []);

  // Show welcome panel if no anomalies
  if (anomalies.length === 0 && !isAnalyzing && !conversation) {
    return (
      <div className="app">
        <WelcomePanel
          isConfigured={isConfigured}
          onAnalyzeRepository={handleAnalyzeRepository}
          onAnalyzeFile={handleAnalyzeFile}
          onOpenSettings={handleOpenSettings}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <div className="tab-bar">
        <button
          className={`tab-button ${activeTab === 'issues' ? 'active' : ''}`}
          onClick={() => setActiveTab('issues')}
        >
          Issues ({anomalies.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
          disabled={!conversation}
        >
          Chat
        </button>
      </div>

      <div className="content">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {isAnalyzing && (
          <div className="loading">
            <div className="loading-spinner" />
          </div>
        )}

        {activeTab === 'issues' && !isAnalyzing && (
          <AnomalyList
            anomalies={anomalies}
            selectedId={selectedAnomalyId}
            onSelect={handleSelectAnomaly}
            onOpenFile={handleOpenFile}
            onAnalyzeRepository={handleAnalyzeRepository}
            onAnalyzeFile={handleAnalyzeFile}
          />
        )}

        {activeTab === 'chat' && conversation && (
          <ChatPanel
            anomaly={conversation.anomaly}
            messages={conversation.messages}
            isLoading={isChatLoading}
            onSendMessage={handleSendMessage}
            onApplyFix={() => handleApplyFix(conversation.anomalyId)}
            onBack={handleBackToList}
          />
        )}
      </div>
    </div>
  );
}

export default App;
