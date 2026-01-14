import { useState, useRef, useEffect } from 'react';

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

interface ChatPanelProps {
  anomaly: Anomaly;
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (content: string) => void;
  onApplyFix: () => void;
  onBack: () => void;
}

export function ChatPanel({
  anomaly,
  messages,
  isLoading,
  onSendMessage,
  onApplyFix,
  onBack
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = () => {
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--vscode-textLink-foreground)',
              cursor: 'pointer',
              padding: '0',
              fontSize: 'inherit'
            }}
          >
            &larr; Back
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={`severity-badge ${anomaly.severity}`}>
            {anomaly.severity}
          </span>
          <h3>{anomaly.title}</h3>
        </div>
        <p>Line {anomaly.startLine} in {anomaly.file.split(/[/\\]/).pop()}</p>

        {anomaly.codeSnippet && (
          <div className="code-snippet">
            {anomaly.codeSnippet}
          </div>
        )}

        <button
          className="btn btn-secondary"
          onClick={onApplyFix}
          style={{ marginTop: '8px' }}
        >
          Suggest & Apply Fix
        </button>
      </div>

      <div className="messages-container">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {isLoading && (
          <div className="message assistant">
            <div className="loading-spinner" style={{ width: '16px', height: '16px' }} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this issue..."
          disabled={isLoading}
        />
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={!input.trim() || isLoading}
        >
          Send
        </button>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
}

function MessageBubble({ message }: MessageBubbleProps) {
  // Simple markdown-like rendering
  const renderContent = (content: string) => {
    // Split by code blocks
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        // Code block
        const code = part.slice(3, -3);
        const firstNewline = code.indexOf('\n');
        const codeContent = firstNewline > 0 ? code.slice(firstNewline + 1) : code;

        return (
          <pre key={index}>
            <code>{codeContent.trim()}</code>
          </pre>
        );
      }

      // Handle inline code
      const inlineCodeParts = part.split(/(`[^`]+`)/g);
      return inlineCodeParts.map((inlinePart, inlineIndex) => {
        if (inlinePart.startsWith('`') && inlinePart.endsWith('`')) {
          return <code key={`${index}-${inlineIndex}`}>{inlinePart.slice(1, -1)}</code>;
        }

        // Handle bold
        const boldParts = inlinePart.split(/(\*\*[^*]+\*\*)/g);
        return boldParts.map((boldPart, boldIndex) => {
          if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
            return <strong key={`${index}-${inlineIndex}-${boldIndex}`}>{boldPart.slice(2, -2)}</strong>;
          }
          return <span key={`${index}-${inlineIndex}-${boldIndex}`}>{boldPart}</span>;
        });
      });
    });
  };

  return (
    <div className={`message ${message.role}`}>
      {renderContent(message.content)}
    </div>
  );
}
