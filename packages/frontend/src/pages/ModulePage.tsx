import React, { Suspense } from 'react';
import { useParams } from 'react-router-dom';
import DynamicWidget from '../components/dashboard/DynamicWidget';

// A registry of module main pages if they exist
// Similar to widget registry, but for full pages
const MODULE_PAGE_REGISTRY: Record<string, React.LazyExoticComponent<any>> = {
    'knowledge-base': React.lazy(() => import('../modules/documentation-manager/pages/DocumentationPage')),
    'ai-copilot': React.lazy(() => import('../modules/ai-copilot/pages/ForgePage')),
};

// Registry for module sub-pages (e.g., /modules/ai-copilot/settings)
const MODULE_SUBPAGE_REGISTRY: Record<string, Record<string, React.LazyExoticComponent<any>>> = {
    'ai-copilot': {
        'settings': React.lazy(() => import('../modules/ai-copilot/pages/SettingsPage')),
        'chat': React.lazy(() => import('../modules/ai-copilot/pages/ChatPage')),
        'knowledge': React.lazy(() => import('../modules/ai-copilot/pages/KnowledgePage')),
    },
    'consumption': {
        'live': React.lazy(() => import('../pages/LiveDashboardPage')),
        'endpoints': React.lazy(() => import('../pages/EndpointsPage')),
        'reports': React.lazy(() => import('../pages/ReportsPage')),
        'history': React.lazy(() => import('../pages/HistoryPage')),
    },
};

export default function ModulePage() {
    const { moduleName, '*': subPath } = useParams<{ moduleName: string; '*': string }>();

    // Extract sub-route (e.g., "settings" from /modules/ai-copilot/settings)
    const subRoute = subPath?.split('/')[0] || '';

    // Check if we have a registered sub-page for this module + subRoute
    const subPages = moduleName ? MODULE_SUBPAGE_REGISTRY[moduleName] : null;
    const SubPageComponent = subPages && subRoute ? subPages[subRoute] : null;

    if (SubPageComponent) {
        return (
            <Suspense fallback={<div className="p-8">Loading...</div>}>
                <SubPageComponent />
            </Suspense>
        );
    }

    // Check if we have a registered main page for this module
    const ModuleComponent = moduleName ? MODULE_PAGE_REGISTRY[moduleName] : null;

    if (ModuleComponent) {
        return (
            <Suspense fallback={<div className="p-8">Loading module...</div>}>
                <ModuleComponent />
            </Suspense>
        );
    }

    // Fallback: Show a default dashboard style page for modules that only provide widgets
    // or a "Construction" page

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white capitalize">
                    {moduleName?.replace('-', ' ')}
                </h1>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
                        <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                            {moduleName?.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        Module Active
                    </h3>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        The {moduleName} module is running.
                    </p>

                    {/* If it's consumption-monitor, let's show the widget here too as a demo */}
                    {moduleName === 'consumption-monitor' && (
                        <div className="mt-8 mx-auto max-w-sm h-64">
                            <DynamicWidget
                                moduleName="consumption-monitor"
                                componentPath="./components/LivePowerWidget"
                                title="Live Power Usage"
                                refreshInterval={5000}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

