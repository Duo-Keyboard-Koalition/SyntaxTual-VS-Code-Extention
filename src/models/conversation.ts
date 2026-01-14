export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
    id: string;
    role: MessageRole;
    content: string;
    timestamp: number;
}

export interface Conversation {
    id: string;
    anomalyId: string;
    messages: Message[];
    createdAt: number;
    updatedAt: number;
}

export interface AnomalyContext {
    file: string;
    range: {
        start: number;
        end: number;
    };
    codeSnippet: string;
    anomaly: {
        title: string;
        description: string;
        type: string;
    };
    language: string;
}
