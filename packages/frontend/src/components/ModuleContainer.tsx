/**
 * Module Container component
 * Handles lazy loading and rendering of module UI components
 */

import { Suspense, lazy, useMemo } from 'react';
import ErrorBoundary from './ErrorBoundary';
import { ModuleComponentProps } from '../types/module.types';

interface ModuleContainerProps {
  moduleName: string;
  moduleId: string;
  componentPath: string;
  config?: Record<string, any>;
  fallback?: React.ReactNode;
}

/**
 * Loading fallback component
 */
function ModuleLoadingFallback({ moduleName }: { moduleName: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px] bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">
          Loading {moduleName} module...
        </p>
      </div>
    </div>
  );
}

/**
 * Module Container Component
 *
 * Lazy loads and renders module UI components with error boundaries
 *
 * @example
 * ```tsx
 * <ModuleContainer
 *   moduleName="example-module"
 *   moduleId="abc-123"
 *   componentPath="/modules/example-module/components/Dashboard"
 *   config={{ setting1: "value1" }}
 * />
 * ```
 */
export function ModuleContainer({
  moduleName,
  moduleId,
  componentPath,
  config,
  fallback,
}: ModuleContainerProps) {
  // Lazy load the module component
  const ModuleComponent = useMemo(() => {
    return lazy(async () => {
      try {
        // In production, modules would be served from a CDN or modules directory
        // For now, we'll use a dynamic import with the component path
        const module = await import(/* @vite-ignore */ componentPath);

        // Support both default and named exports
        return {
          default: module.default || module[Object.keys(module)[0]],
        };
      } catch (error) {
        console.error(`Failed to load module component at ${componentPath}:`, error);
        throw error;
      }
    });
  }, [componentPath]);

  const moduleProps: ModuleComponentProps = {
    moduleId,
    moduleName,
    config,
  };

  return (
    <ErrorBoundary
      moduleName={moduleName}
      onError={(error, errorInfo) => {
        console.error(`Module "${moduleName}" error:`, error, errorInfo);
        // In production, you could send this to an error tracking service
      }}
    >
      <Suspense
        fallback={fallback || <ModuleLoadingFallback moduleName={moduleName} />}
      >
        <div className="module-container" data-module-name={moduleName}>
          <ModuleComponent {...moduleProps} />
        </div>
      </Suspense>
    </ErrorBoundary>
  );
}

export default ModuleContainer;
