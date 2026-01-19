/**
 * ForgeGlobalChat - Persistent floating chat widget
 * Available on all pages, can be minimized or expanded
 * Phase 4: Connected to real Ollama API with streaming
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChatMessage } from '../../modules/ai-copilot/types';
import { forgeApi } from '../../modules/ai-copilot/api';
import { modulesApi } from '../../api/modules';
import { ModuleStatus } from '../../types/module.types';
import {
    SparklesIcon,
    XMarkIcon,
    ChatBubbleLeftRightIcon,
    ArrowsPointingOutIcon,
    ArrowsPointingInIcon,
    PaperAirplaneIcon,
    Cog6ToothIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

// Chat storage key for persistence
const CHAT_STORAGE_KEY = 'forge-global-chat';
const CHAT_STATE_KEY = 'forge-chat-state';

// Page context mapping
function getPageContext(pathname: string): { name: string; icon: string; color: string } {
    if (pathname.startsWith('/dashboard')) {
        return { name: 'Dashboard', icon: '📊', color: 'text-blue-400' };
    }
    if (pathname.startsWith('/incidents')) {
        return { name: 'Incidents', icon: '🔔', color: 'text-red-400' };
    }
    if (pathname.startsWith('/modules')) {
        return { name: 'Modules', icon: '📦', color: 'text-indigo-400' };
    }
    if (pathname.startsWith('/jobs')) {
        return { name: 'Jobs', icon: '⚡', color: 'text-yellow-400' };
    }
    if (pathname.startsWith('/executions')) {
        return { name: 'Executions', icon: '🔄', color: 'text-green-400' };
    }
    if (pathname.startsWith('/events')) {
        return { name: 'Events', icon: '📡', color: 'text-purple-400' };
    }
    if (pathname.startsWith('/modules/consumption')) {
        return { name: 'Power Monitoring', icon: '⚡', color: 'text-amber-400' };
    }
    if (pathname.startsWith('/settings')) {
        return { name: 'Settings', icon: '⚙️', color: 'text-gray-400' };
    }
    return { name: 'NxForge', icon: '🏠', color: 'text-gray-400' };
}

// Initial system message
const INITIAL_MESSAGES: ChatMessage[] = [
    {
        id: 'system-1',
        role: 'system',
        content: 'Forge is ready. Ask about infrastructure, incidents, or SOPs.',
        timestamp: new Date(),
    },
];

interface ChatState {
    isOpen: boolean;
    isExpanded: boolean;
}

type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

export function ForgeGlobalChat() {
    const location = useLocation();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Check if AI Copilot module is enabled
    const { data: modules } = useQuery({
        queryKey: ['modules'],
        queryFn: () => modulesApi.list(),
        staleTime: 30000, // Cache for 30 seconds
        retry: 1,
    });

    // Check Ollama connection status
    const { data: health, refetch: refetchHealth } = useQuery({
        queryKey: ['forge-health'],
        queryFn: () => forgeApi.getHealth(),
        staleTime: 10000,
        refetchInterval: 15000, // Check every 15 seconds
        retry: 1,
    });

    const aiCopilotModule = modules?.find(m => m.name === 'ai-copilot');
    const isAiCopilotEnabled = aiCopilotModule?.status === ModuleStatus.ENABLED;

    // Connection status
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connected');
    const [retryCount, setRetryCount] = useState(0);

    // Update connection status based on health check
    useEffect(() => {
        if (health?.ollama) {
            setConnectionStatus('connected');
            setRetryCount(0);
        } else if (health && !health.ollama) {
            setConnectionStatus('disconnected');
        }
    }, [health]);

    // Auto-retry when disconnected
    useEffect(() => {
        if (connectionStatus === 'disconnected' && retryCount < 5) {
            setConnectionStatus('reconnecting');
            const timeout = Math.min(5000 * Math.pow(2, retryCount), 30000); // Exponential backoff
            const timer = setTimeout(() => {
                refetchHealth();
                setRetryCount(prev => prev + 1);
            }, timeout);
            return () => clearTimeout(timer);
        }
    }, [connectionStatus, retryCount, refetchHealth]);

    // Chat visibility state
    const [chatState, setChatState] = useState<ChatState>(() => {
        try {
            const saved = localStorage.getItem(CHAT_STATE_KEY);
            return saved ? JSON.parse(saved) : { isOpen: false, isExpanded: false };
        } catch {
            return { isOpen: false, isExpanded: false };
        }
    });

    // Chat messages (persisted)
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
    const [streamingContent, setStreamingContent] = useState('');

    // Persist messages
    useEffect(() => {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    }, [messages]);

    // Persist chat state
    useEffect(() => {
        localStorage.setItem(CHAT_STATE_KEY, JSON.stringify(chatState));
    }, [chatState]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping, streamingContent]);

    // Focus input when opened
    useEffect(() => {
        if (chatState.isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [chatState.isOpen]);

    const toggleOpen = useCallback(() => {
        setChatState(prev => ({ ...prev, isOpen: !prev.isOpen }));
    }, []);

    const toggleExpanded = useCallback(() => {
        setChatState(prev => ({ ...prev, isExpanded: !prev.isExpanded }));
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
        const currentInput = input;
        setInput('');
        setIsTyping(true);
        setStreamingContent('');

        // Get current page context for response
        const pageContext = getPageContext(location.pathname);

        try {
            // Use real Ollama API with streaming
            const contextHint = `User is viewing: ${pageContext.name}`;
            let fullResponse = '';

            // Try streaming first
            try {
                for await (const chunk of forgeApi.chatStream(currentInput, contextHint)) {
                    fullResponse += chunk;
                    setStreamingContent(fullResponse);
                }
            } catch {
                // Fallback to non-streaming
                const response = await forgeApi.chat(currentInput, contextHint);
                if (response.success && response.response) {
                    fullResponse = response.response;
                } else {
                    throw new Error(response.error || 'Failed to get response');
                }
            }

            const forgeMessage: ChatMessage = {
                id: `forge-${Date.now()}`,
                role: 'forge',
                content: fullResponse,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, forgeMessage]);
            setConnectionStatus('connected');
        } catch (error) {
            console.error('Chat error:', error);
            setConnectionStatus('disconnected');

            const errorMessage: ChatMessage = {
                id: `error-${Date.now()}`,
                role: 'system',
                content: '⚠️ Unable to reach Forge. Ollama may be disconnected.',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsTyping(false);
            setStreamingContent('');
        }
    }, [input, location.pathname, isTyping]);

    const handleClear = useCallback(() => {
        setMessages(INITIAL_MESSAGES);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleRetryConnection = () => {
        setRetryCount(0);
        setConnectionStatus('reconnecting');
        refetchHealth();
    };

    // Don't show if AI Copilot module is disabled or if on Forge module pages
    const isOnForgePage = location.pathname.startsWith('/modules/ai-copilot');

    if (!isAiCopilotEnabled || isOnForgePage) {
        return null;
    }

    const { isOpen, isExpanded } = chatState;

    // Fab button (minimized state)
    if (!isOpen) {
        return (
            <button
                onClick={toggleOpen}
                className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 text-white shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-105 transition-all"
                title="Open Forge Chat"
            >
                <SparklesIcon className="h-6 w-6" />
                {/* Status indicator */}
                <span className={`absolute top-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${connectionStatus === 'connected' ? 'bg-green-500' :
                        connectionStatus === 'reconnecting' ? 'bg-yellow-500 animate-pulse' :
                            'bg-red-500'
                    }`} />
            </button>
        );
    }

    // Get current page context
    const pageContext = getPageContext(location.pathname);

    // Panel dimensions
    const panelClass = isExpanded
        ? 'w-[500px] h-[600px]'
        : 'w-[360px] h-[480px]';

    return (
        <div
            className={`fixed bottom-6 right-6 z-50 ${panelClass} flex flex-col bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 overflow-hidden transition-all duration-200`}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-gray-800">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                        <SparklesIcon className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-sm">Forge</span>
                            <span className={`text-xs ${connectionStatus === 'connected' ? 'text-green-400' :
                                    connectionStatus === 'reconnecting' ? 'text-yellow-400' :
                                        'text-red-400'
                                }`}>●</span>
                        </div>
                        <span className={`text-xs ${pageContext.color}`}>
                            {pageContext.icon} {pageContext.name}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Link
                        to="/modules/ai-copilot/settings"
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                        title="Settings"
                    >
                        <Cog6ToothIcon className="h-4 w-4" />
                    </Link>
                    <button
                        onClick={toggleExpanded}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                        title={isExpanded ? 'Shrink' : 'Expand'}
                    >
                        {isExpanded ? (
                            <ArrowsPointingInIcon className="h-4 w-4" />
                        ) : (
                            <ArrowsPointingOutIcon className="h-4 w-4" />
                        )}
                    </button>
                    <button
                        onClick={toggleOpen}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                        title="Close"
                    >
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Connection Warning Banner */}
            {connectionStatus !== 'connected' && (
                <div className="flex items-center justify-between px-4 py-2 bg-yellow-900/50 border-b border-yellow-800/50">
                    <div className="flex items-center gap-2 text-yellow-300 text-xs">
                        <ExclamationTriangleIcon className="h-4 w-4" />
                        <span>
                            {connectionStatus === 'reconnecting' ? 'Reconnecting to Ollama...' : 'Ollama disconnected'}
                        </span>
                    </div>
                    <button
                        onClick={handleRetryConnection}
                        className="text-xs text-yellow-400 hover:text-yellow-200 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                ))}
                {isTyping && (
                    <div className="flex justify-start">
                        <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm bg-gray-800 text-gray-100 rounded-bl-sm">
                            {streamingContent || (
                                <div className="flex items-center gap-2 text-gray-400">
                                    <div className="flex gap-1">
                                        <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                    <span>Thinking...</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 p-3 bg-gray-800/50 border-t border-gray-800">
                <div className="flex items-center gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask Forge..."
                        disabled={isTyping}
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isTyping}
                        className="p-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:hover:bg-purple-600 text-white rounded-lg transition-colors"
                    >
                        <PaperAirplaneIcon className="h-4 w-4" />
                    </button>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <button onClick={handleClear} className="hover:text-gray-300 transition-colors">
                        Clear chat
                    </button>
                    <Link to="/modules/ai-copilot/chat" className="hover:text-purple-400 transition-colors flex items-center gap-1">
                        <ChatBubbleLeftRightIcon className="h-3 w-3" />
                        Open full view
                    </Link>
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
            <div className="text-center text-xs text-gray-500 py-2">
                {message.content}
            </div>
        );
    }

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${isUser
                    ? 'bg-purple-600 text-white rounded-br-sm'
                    : 'bg-gray-800 text-gray-100 rounded-bl-sm'
                    }`}
            >
                {message.content}
            </div>
        </div>
    );
}

export default ForgeGlobalChat;

