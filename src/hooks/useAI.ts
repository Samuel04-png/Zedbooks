import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { firebaseFunctions as functions } from '@/integrations/firebase/client';
import { toast } from 'sonner';

export interface AIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
}

export function useAI() {
    const [messages, setMessages] = useState<AIMessage[]>([
        {
            role: 'assistant',
            content: 'Hello! I am your ZedBooks financial assistant. I can help you analyze your data, explain accounting concepts, or check for anomalies. How can I help you today?',
            timestamp: new Date().toISOString(),
        },
    ]);
    const [isLoading, setIsLoading] = useState(false);

    const askAI = async (query: string, companyId?: string) => {
        if (!query.trim()) return;

        // Add user message
        const userMessage: AIMessage = {
            role: 'user',
            content: query,
            timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMessage]);
        setIsLoading(true);

        try {
            const askDeepSeek = httpsCallable<{ query: string; includeFinancialContext: boolean; companyId?: string }, { answer: string }>(functions, 'askDeepSeek');

            const result = await askDeepSeek({
                query,
                includeFinancialContext: true,
                companyId,
            });

            const aiMessage: AIMessage = {
                role: 'assistant',
                content: result.data.answer,
                timestamp: new Date().toISOString(),
            };

            setMessages((prev) => [...prev, aiMessage]);
        } catch (error) {
            console.error("AI Error:", error);
            toast.error("Failed to get response from AI assistant.");
            setMessages((prev) => [...prev, {
                role: 'assistant',
                content: "I'm sorry, I encountered an error while processing your request. Please try again later.",
                timestamp: new Date().toISOString(),
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const clearChat = () => {
        setMessages([
            {
                role: 'assistant',
                content: 'Chat cleared. How can I help you now?',
                timestamp: new Date().toISOString(),
            },
        ]);
    };

    return {
        messages,
        isLoading,
        askAI,
        clearChat
    };
}
