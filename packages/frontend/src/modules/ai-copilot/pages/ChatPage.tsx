/**
 * Forge Chat Page - Full chat view
 * Dedicated page for extended conversations with Forge AI
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChatMessage } from '../types';
import {
    SparklesIcon,
    PaperAirplaneIcon,
    Cog6ToothIcon,
    TrashIcon,
    DocumentTextIcon,
    BoltIcon,
} from '@heroicons/react/24/outline';

// Chat storage key - shared with global widget
const CHAT_STORAGE_KEY = 'forge-global-chat';

// Initial system message
const INITIAL_MESSAGES: ChatMessage[] = [
    {
        id: 'system-1',
        role: 'system',
        content: 'Forge is ready. Ask about infrastructure, incidents, or SOPs.',
        timestamp: new Date(),
    },
];

export function ChatPage() {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Chat messages (shared with global widget via localStorage)
    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        try {
            const saved = localStorage.getItem(CHAT_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
            }
        } catch { }
        return INITIAL_MESSAGES;
    });

    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // Persist messages
    useEffect(() => {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    }, [messages]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSend = useCallback(async () => {
        if (!input.trim() || isTyping) return;

        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: input,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsTyping(true);

        try {
            const { forgeApi } = await import('../api');

            // Use non-streaming for now to match ChatWidget implementation
            // The API supports streaming but we'll stick to simple response for stability first
            const response = await forgeApi.chat(userMessage.content);

            if (response.success && response.response) {
                const forgeMessage: ChatMessage = {
                    id: `forge-${Date.now()}`,
                    role: 'forge',
                    content: response.response,
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, forgeMessage]);
            } else {
                throw new Error(response.error || 'Failed to get response');
            }
        } catch (error) {
            console.error('Chat failed:', error);
            const errorMessage: ChatMessage = {
                id: `error-${Date.now()}`,
                role: 'system',
                content: 'Error: Could not connect to Forge. Please ensure the backend and Ollama are running.',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsTyping(false);
        }
    }, [input, isTyping]);

    const handleClear = useCallback(() => {
        setMessages(INITIAL_MESSAGES);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
            {/* Header */}
            {/* Header */}
            <header className="relative flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50">
                <div className="flex items-center gap-4 z-10">
                    {/* Left side empty for now */}
                </div>

                <div className="absolute left-1/2 lg:left-[calc(50%-8rem)] top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3 transition-all duration-300">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <SparklesIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-gray-900 dark:text-white leading-tight">Forge Chat</h1>
                        <div className="flex items-center gap-1.5">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            <span className="text-xs font-medium text-green-600 dark:text-green-400">Online</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 z-10">
                    <button
                        onClick={handleClear}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <TrashIcon className="h-4 w-4" />
                        Clear
                    </button>
                    <Link
                        to="/modules/ai-copilot/settings"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <Cog6ToothIcon className="h-4 w-4" />
                        Settings
                    </Link>
                </div>
            </header>

            {/* Chat Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col">
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="max-w-3xl mx-auto space-y-4">
                            {messages.map((message) => (
                                <MessageBubble key={message.id} message={message} />
                            ))}
                            {isTyping && (
                                <div className="flex items-center gap-3 text-gray-400">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-600/20 flex items-center justify-center">
                                        <SparklesIcon className="h-4 w-4 text-purple-400" />
                                    </div>
                                    <div className="flex gap-1">
                                        <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                    <span className="text-sm">Forge is thinking...</span>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* Input */}
                    <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50">
                        <div className="max-w-3xl mx-auto">
                            <div className="flex items-end gap-3">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask Forge about infrastructure, incidents, or SOPs..."
                                    rows={1}
                                    className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                                    style={{ minHeight: '48px', maxHeight: '200px' }}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim()}
                                    className="p-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:hover:bg-purple-600 text-white rounded-xl transition-colors"
                                >
                                    <PaperAirplaneIcon className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500">
                                <span>Press Enter to send, Shift+Enter for new line</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions Sidebar */}
                <div className="w-64 border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 p-4 hidden lg:block">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Quick Actions</h3>
                    <div className="space-y-2">
                        <button
                            onClick={() => setInput('Show me active incidents')}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <BoltIcon className="h-4 w-4 text-red-500 dark:text-red-400" />
                            Active incidents
                        </button>
                        <button
                            onClick={() => setInput('What SOPs are available?')}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <DocumentTextIcon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                            Available SOPs
                        </button>
                        <button
                            onClick={() => setInput('Show power status for all zones')}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <BoltIcon className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
                            Power status
                        </button>
                        <button
                            onClick={() => setInput('/help')}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <SparklesIcon className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                            Help & commands
                        </button>
                    </div>

                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-6 mb-3">Current Context</h3>
                    <div className="p-3 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                        <p className="text-xs text-gray-500 mb-1">Focus:</p>
                        <p className="text-gray-900 dark:text-gray-300">Infrastructure-wide</p>
                        <p className="text-xs text-gray-500 mt-2 mb-1">Active Alerts:</p>
                        <p className="text-gray-900 dark:text-gray-300">3 incidents</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Message bubble component
function MessageBubble({ message }: { message: ChatMessage }) {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';

    if (isSystem) {
        return (
            <div className="text-center text-sm text-gray-500 py-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800/50 rounded-full">
                    <SparklesIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    {message.content}
                </div>
            </div>
        );
    }

    if (isUser) {
        return (
            <div className="flex justify-end">
                <div className="max-w-[70%] bg-purple-600 text-white rounded-2xl rounded-br-sm px-4 py-3">
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs text-purple-200 mt-1 text-right">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
            </div>
        );
    }

    // Forge message
    return (
        <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-600/20 flex items-center justify-center">
                <SparklesIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="max-w-[70%] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p className="text-xs text-gray-500 mt-1">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
            </div>
        </div>
    );
}



export default ChatPage;
