/**
 * IncidentsPage - Core Monitoring Page
 * Displays the Situation Deck for live incident monitoring
 * Phase 3: Connected to real API via AlertBatcherService
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Incident } from '../../types/monitoring.types';
import { IncidentCard } from '../../components/monitoring/IncidentCard';
import { forgeApi, IncidentListItem } from '../../modules/ai-copilot/api';
import {
    ListBulletIcon,
    Squares2X2Icon,
    BellAlertIcon,
    SparklesIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

type ViewMode = 'summary' | 'expanded';

/**
 * Transform API incident to frontend Incident type
 */
function transformIncident(apiIncident: IncidentListItem): Incident {
    return {
        id: apiIncident.id,
        title: apiIncident.title,
        severity: apiIncident.severity,
        status: apiIncident.status as Incident['status'],
        impact: apiIncident.impact,
        duration: apiIncident.duration,
        alertCount: apiIncident.alertCount,
        hasForgeAnalysis: apiIncident.hasForgeAnalysis,
        createdAt: new Date(apiIncident.createdAt),
    };
}

export default function IncidentsPage() {
    const [viewMode, setViewMode] = useState<ViewMode>('summary');
    const [expandedIncidentId, setExpandedIncidentId] = useState<string | null>(null);
    const queryClient = useQueryClient();

    // Fetch incidents with auto-refresh
    const {
        data: incidentsResponse,
        isLoading,
        isError,
        error,
        refetch,
        isRefetching,
    } = useQuery({
        queryKey: ['incidents', 'active'],
        queryFn: () => forgeApi.getIncidents('active'),
        refetchInterval: 5000, // Refresh every 5 seconds
        staleTime: 2000,
    });

    // Mutation for dismissing incidents
    const dismissMutation = useMutation({
        mutationFn: (incidentId: string) =>
            forgeApi.updateIncident(incidentId, { status: 'dismissed' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['incidents'] });
        },
    });

    const incidents: Incident[] = incidentsResponse?.success
        ? incidentsResponse.incidents.map(transformIncident)
        : [];

    const handleExpand = (incidentId: string) => {
        setExpandedIncidentId(prev => (prev === incidentId ? null : incidentId));
    };

    const handleDismiss = (incidentId: string) => {
        dismissMutation.mutate(incidentId);
    };

    const handleChatWithForge = (incident: Incident) => {
        // Open Forge chat with incident context
        localStorage.setItem('forge-context-incident', JSON.stringify(incident));
        window.location.href = '/modules/ai-copilot/chat';
    };

    const handleRefresh = () => {
        refetch();
    };

    const criticalCount = incidents.filter(i => i.severity === 'critical').length;
    const warningCount = incidents.filter(i => i.severity === 'warning').length;
    const infoCount = incidents.filter(i => i.severity === 'info').length;

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
            {/* Page Header */}
            <div className="flex-shrink-0 px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-lg shadow-red-500/25">
                                <BellAlertIcon className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                                    Incidents
                                </h1>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Live Infrastructure Monitoring
                                </p>
                            </div>
                        </div>

                        {/* Status Summary Pills */}
                        <div className="flex items-center gap-2 ml-4">
                            {criticalCount > 0 && (
                                <span className="px-2.5 py-1 text-xs font-medium bg-red-500 text-white rounded-full animate-pulse">
                                    {criticalCount} Critical
                                </span>
                            )}
                            {warningCount > 0 && (
                                <span className="px-2.5 py-1 text-xs font-medium bg-yellow-500 text-black rounded-full">
                                    {warningCount} Warning
                                </span>
                            )}
                            {infoCount > 0 && (
                                <span className="px-2.5 py-1 text-xs font-medium bg-blue-500 text-white rounded-full">
                                    {infoCount} Info
                                </span>
                            )}
                            {!isLoading && incidents.length === 0 && (
                                <span className="px-2.5 py-1 text-xs font-medium bg-green-500 text-white rounded-full">
                                    All Clear
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Refresh Button */}
                        <button
                            onClick={handleRefresh}
                            disabled={isRefetching}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <ArrowPathIcon className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>

                        {/* View Mode Toggle */}
                        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                            <button
                                onClick={() => setViewMode('summary')}
                                className={`
                                    p-2 rounded-md transition-colors
                                    ${viewMode === 'summary'
                                        ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}
                                `}
                                title="Summary View"
                            >
                                <Squares2X2Icon className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('expanded')}
                                className={`
                                    p-2 rounded-md transition-colors
                                    ${viewMode === 'expanded'
                                        ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}
                                `}
                                title="Expanded View"
                            >
                                <ListBulletIcon className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Ask Forge Button */}
                        <Link
                            to="/modules/ai-copilot/chat"
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                        >
                            <SparklesIcon className="h-4 w-4" />
                            Ask Forge
                        </Link>
                    </div>
                </div>
            </div>

            {/* Incidents List */}
            <div className="flex-1 overflow-y-auto p-6">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <div className="w-12 h-12 mx-auto mb-4 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin" />
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Loading incidents...
                            </p>
                        </div>
                    </div>
                ) : isError ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                                <ExclamationTriangleIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                                Failed to Load Incidents
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                {(error as Error)?.message || 'Unable to fetch incidents'}
                            </p>
                            <button
                                onClick={() => refetch()}
                                className="px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                ) : incidents.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                                <BellAlertIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                                All Clear
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                No active incidents at this time
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto space-y-4">
                        {incidents.map(incident => (
                            <IncidentCard
                                key={incident.id}
                                incident={incident}
                                isExpanded={viewMode === 'expanded' || expandedIncidentId === incident.id}
                                onExpand={() => handleExpand(incident.id)}
                                onChatWithForge={() => handleChatWithForge(incident)}
                                onDismiss={() => handleDismiss(incident.id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

