import * as vscode from 'vscode';
import { OpenAIService } from './openaiService';
import { Conversation, Message, AnomalyContext, Anomaly } from '../models';

export class ConversationManager {
    private conversations: Map<string, Conversation> = new Map();
    private openaiService: OpenAIService;
    private context: vscode.ExtensionContext;
    private onConversationUpdatedEmitter = new vscode.EventEmitter<Conversation>();

    public readonly onConversationUpdated = this.onConversationUpdatedEmitter.event;

    constructor(openaiService: OpenAIService, context: vscode.ExtensionContext) {
        this.openaiService = openaiService;
        this.context = context;
        this.loadConversations();
    }

    private loadConversations(): void {
        const saved = this.context.globalState.get<Record<string, Conversation>>('conversations', {});
        for (const [id, conv] of Object.entries(saved)) {
            this.conversations.set(id, conv);
        }
    }

    private async saveConversations(): Promise<void> {
        const data: Record<string, Conversation> = {};
        for (const [id, conv] of this.conversations) {
            data[id] = conv;
        }
        await this.context.globalState.update('conversations', data);
    }

    getConversation(anomalyId: string): Conversation | undefined {
        return this.conversations.get(anomalyId);
    }

    getAllConversations(): Conversation[] {
        return Array.from(this.conversations.values());
    }

    async startConversation(anomaly: Anomaly): Promise<Conversation> {
        // Check if conversation already exists
        let conversation = this.conversations.get(anomaly.id);

        if (!conversation) {
            conversation = {
                id: `conv-${anomaly.id}`,
                anomalyId: anomaly.id,
                messages: [],
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            // Add initial system context as first message
            const initialMessage: Message = {
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: `I've identified an issue in your code:\n\n**${anomaly.title}**\n\n${anomaly.description}\n\n${anomaly.suggestion ? `**Suggestion:** ${anomaly.suggestion}` : ''}\n\nWould you like me to explain this issue in more detail or help you fix it?`,
                timestamp: Date.now()
            };

            conversation.messages.push(initialMessage);
            this.conversations.set(anomaly.id, conversation);
            await this.saveConversations();
        }

        return conversation;
    }

    async sendMessage(
        anomalyId: string,
        content: string,
        anomalyContext: AnomalyContext
    ): Promise<Message> {
        const conversation = this.conversations.get(anomalyId);

        if (!conversation) {
            throw new Error('Conversation not found');
        }

        // Add user message
        const userMessage: Message = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content,
            timestamp: Date.now()
        };

        conversation.messages.push(userMessage);
        conversation.updatedAt = Date.now();

        // Get AI response
        const response = await this.openaiService.chat(
            conversation.messages.filter(m => m.role !== 'system'),
            anomalyContext
        );

        // Add assistant response
        const assistantMessage: Message = {
            id: `msg-${Date.now() + 1}`,
            role: 'assistant',
            content: response,
            timestamp: Date.now()
        };

        conversation.messages.push(assistantMessage);
        conversation.updatedAt = Date.now();

        await this.saveConversations();
        this.onConversationUpdatedEmitter.fire(conversation);

        return assistantMessage;
    }

    async deleteConversation(anomalyId: string): Promise<void> {
        this.conversations.delete(anomalyId);
        await this.saveConversations();
    }

    async clearAllConversations(): Promise<void> {
        this.conversations.clear();
        await this.saveConversations();
    }

    buildAnomalyContext(anomaly: Anomaly, document: vscode.TextDocument): AnomalyContext {
        return {
            file: anomaly.location.file,
            range: {
                start: anomaly.location.range.start.line + 1,
                end: anomaly.location.range.end.line + 1
            },
            codeSnippet: anomaly.location.codeSnippet || document.getText(anomaly.location.range),
            anomaly: {
                title: anomaly.title,
                description: anomaly.description,
                type: anomaly.type
            },
            language: document.languageId
        };
    }
}
