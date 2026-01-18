/**
 * Skeleton Components
 * Provides loading placeholder UI that matches the app's layout
 * Supports both dark and light themes via Tailwind dark: classes
 */

interface SkeletonProps {
    className?: string;
}

/**
 * Base skeleton element with animation
 */
export function Skeleton({ className = '' }: SkeletonProps) {
    return (
        <div
            className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
        />
    );
}

/**
 * Skeleton for text lines
 */
export function SkeletonText({
    lines = 3,
    className = '',
}: {
    lines?: number;
    className?: string;
}) {
    return (
        <div className={`space-y-2 ${className}`}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
                />
            ))}
        </div>
    );
}

/**
 * Skeleton for card components
 */
export function SkeletonCard({ className = '' }: SkeletonProps) {
    return (
        <div
            className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}
        >
            <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <Skeleton className="h-8 w-24 mb-2" />
            <Skeleton className="h-4 w-40" />
        </div>
    );
}

/**
 * Skeleton for stat cards (dashboard)
 */
export function SkeletonStatCard() {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-8 w-16 mb-1" />
                    <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-12 w-12 rounded-lg" />
            </div>
        </div>
    );
}

/**
 * Skeleton for table rows
 */
export function SkeletonTableRow({ columns = 5 }: { columns?: number }) {
    return (
        <tr className="border-b border-gray-200 dark:border-gray-700">
            {Array.from({ length: columns }).map((_, i) => (
                <td key={i} className="px-6 py-4">
                    <Skeleton className={`h-4 ${i === 0 ? 'w-32' : 'w-20'}`} />
                </td>
            ))}
        </tr>
    );
}

/**
 * Skeleton for a full table
 */
export function SkeletonTable({
    rows = 5,
    columns = 5,
}: {
    rows?: number;
    columns?: number;
}) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Table header */}
            <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 px-6 py-3">
                <div className="flex gap-4">
                    {Array.from({ length: columns }).map((_, i) => (
                        <Skeleton key={i} className="h-4 w-20" />
                    ))}
                </div>
            </div>
            {/* Table body */}
            <table className="min-w-full">
                <tbody>
                    {Array.from({ length: rows }).map((_, i) => (
                        <SkeletonTableRow key={i} columns={columns} />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/**
 * Skeleton for list items
 */
export function SkeletonListItem() {
    return (
        <div className="flex items-center gap-4 p-4 border-b border-gray-200 dark:border-gray-700">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-8 w-20 rounded" />
        </div>
    );
}

/**
 * Page header skeleton
 */
export function SkeletonPageHeader() {
    return (
        <div className="mb-6">
            <div className="flex items-center justify-between">
                <div>
                    <Skeleton className="h-8 w-48 mb-2" />
                    <Skeleton className="h-4 w-72" />
                </div>
                <div className="flex gap-3">
                    <Skeleton className="h-10 w-32 rounded-lg" />
                    <Skeleton className="h-10 w-10 rounded-lg" />
                </div>
            </div>
        </div>
    );
}

/**
 * Full page skeleton - matches the dashboard layout
 * This is used as the Suspense fallback for lazy-loaded pages
 */
export function PageSkeleton({ variant = 'dashboard' }: { variant?: 'dashboard' | 'table' | 'form' }) {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 transition-colors">
            {/* Page header */}
            <SkeletonPageHeader />

            {variant === 'dashboard' && (
                <>
                    {/* Stats grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <SkeletonStatCard />
                        <SkeletonStatCard />
                        <SkeletonStatCard />
                        <SkeletonStatCard />
                    </div>

                    {/* Content area */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                            <SkeletonCard className="h-80" />
                        </div>
                        <div>
                            <SkeletonCard className="h-80" />
                        </div>
                    </div>
                </>
            )}

            {variant === 'table' && (
                <>
                    {/* Filter bar */}
                    <div className="flex items-center gap-4 mb-6">
                        <Skeleton className="h-10 w-64 rounded-lg" />
                        <Skeleton className="h-10 w-32 rounded-lg" />
                        <Skeleton className="h-10 w-32 rounded-lg" />
                    </div>

                    {/* Table */}
                    <SkeletonTable rows={8} columns={6} />
                </>
            )}

            {variant === 'form' && (
                <div className="max-w-2xl">
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                        <div className="space-y-6">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i}>
                                    <Skeleton className="h-4 w-24 mb-2" />
                                    <Skeleton className="h-10 w-full rounded-lg" />
                                </div>
                            ))}
                            <div className="flex justify-end gap-3 pt-4">
                                <Skeleton className="h-10 w-24 rounded-lg" />
                                <Skeleton className="h-10 w-32 rounded-lg" />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Minimal skeleton for inline loading states
 * Used when loading content within an existing page
 */
export function InlineSkeleton() {
    return (
        <div className="flex items-center justify-center py-12">
            <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-b-blue-600 dark:border-b-blue-400 border-gray-300 dark:border-gray-600 mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
            </div>
        </div>
    );
}

export default PageSkeleton;
