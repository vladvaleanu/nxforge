/**
 * Dashboard page with customizable drag-and-drop cards
 */

import { useState, useEffect, DragEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, LockOpen, RotateCcw, Plus } from 'lucide-react';
import { dashboardApi, DashboardCardConfig } from '../api/dashboard';
import { showError, showSuccess } from '../utils/toast.utils';
import DashboardCard from '../components/dashboard/DashboardCard';
import ModulesCard from '../components/dashboard/cards/ModulesCard';
import JobsCard from '../components/dashboard/cards/JobsCard';
import ExecutionsCard from '../components/dashboard/cards/ExecutionsCard';
import QueueCard from '../components/dashboard/cards/QueueCard';
import RecentExecutionsCard from '../components/dashboard/cards/RecentExecutionsCard';

// Default layout configuration
const DEFAULT_CARDS: DashboardCardConfig[] = [
  { id: 'modules', type: 'modules', x: 0, y: 0, w: 1, h: 1, visible: true },
  { id: 'jobs', type: 'jobs', x: 1, y: 0, w: 1, h: 1, visible: true },
  { id: 'executions', type: 'executions', x: 2, y: 0, w: 1, h: 1, visible: true },
  { id: 'queue', type: 'queue', x: 0, y: 1, w: 1, h: 1, visible: true },
  { id: 'recent', type: 'recent', x: 1, y: 1, w: 2, h: 1, visible: true },
];

const AVAILABLE_CARD_TYPES = [
  { type: 'modules', label: 'Modules', icon: '📦' },
  { type: 'jobs', label: 'Jobs', icon: '⏰' },
  { type: 'executions', label: 'Executions', icon: '▶️' },
  { type: 'queue', label: 'Queue', icon: '📊' },
  { type: 'recent', label: 'Recent Activity', icon: '📋' },
];

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [cards, setCards] = useState<DashboardCardConfig[]>(DEFAULT_CARDS);
  const [isLocked, setIsLocked] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Fetch dashboard stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await dashboardApi.getStats();
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to load dashboard stats');
      }
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch user's layout preferences
  const { data: layoutData } = useQuery({
    queryKey: ['dashboard-layout'],
    queryFn: async () => {
      const response = await dashboardApi.getLayout();
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to load layout');
      }
      return response.data;
    },
  });

  // Save layout mutation
  const saveLayoutMutation = useMutation({
    mutationFn: async ({ layout, locked }: { layout: DashboardCardConfig[]; locked: boolean }) => {
      const response = await dashboardApi.saveLayout(layout, locked);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to save layout');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-layout'] });
      showSuccess('Dashboard layout saved');
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  // Load saved layout
  useEffect(() => {
    if (layoutData) {
      setCards(layoutData.layout);
      setIsLocked(layoutData.locked);
    }
  }, [layoutData]);

  // Drag and drop handlers
  const handleDragStart = (e: DragEvent<HTMLDivElement>, id: string) => {
    setDraggingId(id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');

    if (draggedId === targetId) return;

    setCards(prevCards => {
      const newCards = [...prevCards];
      const draggedIndex = newCards.findIndex(c => c.id === draggedId);
      const targetIndex = newCards.findIndex(c => c.id === targetId);

      if (draggedIndex === -1 || targetIndex === -1) return prevCards;

      // Swap positions
      const temp = { ...newCards[draggedIndex] };
      newCards[draggedIndex] = {
        ...newCards[draggedIndex],
        x: newCards[targetIndex].x,
        y: newCards[targetIndex].y,
      };
      newCards[targetIndex] = {
        ...newCards[targetIndex],
        x: temp.x,
        y: temp.y,
      };

      return newCards;
    });
  };

  const handleRemoveCard = (id: string) => {
    setCards(prevCards => prevCards.map(c =>
      c.id === id ? { ...c, visible: false } : c
    ));
  };

  const handleAddCard = (type: string) => {
    const newId = `${type}-${Date.now()}`;
    const newCard: DashboardCardConfig = {
      id: newId,
      type,
      x: 0,
      y: Math.max(...cards.map(c => c.y + c.h), 0),
      w: 1,
      h: 1,
      visible: true,
    };
    setCards([...cards, newCard]);
    setShowAddMenu(false);
  };

  const handleToggleExpand = (id: string) => {
    setCards(prevCards => prevCards.map(c => {
      if (c.id === id) {
        const newW = c.w === 1 ? 2 : 1;
        const newH = c.h === 1 ? 2 : 1;
        return { ...c, w: newW, h: newH };
      }
      return c;
    }));
  };

  const handleSaveLayout = () => {
    saveLayoutMutation.mutate({ layout: cards, locked: isLocked });
  };

  const handleResetLayout = () => {
    setCards(DEFAULT_CARDS);
    setIsLocked(false);
  };

  const handleToggleLock = () => {
    const newLocked = !isLocked;
    setIsLocked(newLocked);
    if (newLocked) {
      saveLayoutMutation.mutate({ layout: cards, locked: newLocked });
    }
  };

  const renderCard = (card: DashboardCardConfig) => {
    if (!card.visible) return null;

    const stats = statsData;
    let content = null;

    switch (card.type) {
      case 'modules':
        content = stats ? (
          <ModulesCard
            total={stats.modules.total}
            active={stats.modules.active}
            inactive={stats.modules.inactive}
            isLoading={statsLoading}
          />
        ) : null;
        break;
      case 'jobs':
        content = stats ? (
          <JobsCard
            total={stats.jobs.total}
            enabled={stats.jobs.enabled}
            disabled={stats.jobs.disabled}
            isLoading={statsLoading}
          />
        ) : null;
        break;
      case 'executions':
        content = stats ? (
          <ExecutionsCard
            total={stats.executions.total}
            last24h={stats.executions.last24h}
            successRate={stats.executions.successRate}
            isLoading={statsLoading}
          />
        ) : null;
        break;
      case 'queue':
        content = stats ? (
          <QueueCard queue={stats.queue} isLoading={statsLoading} />
        ) : null;
        break;
      case 'recent':
        content = stats ? (
          <RecentExecutionsCard
            executions={stats.recentExecutions}
            isLoading={statsLoading}
          />
        ) : null;
        break;
      default:
        content = <div>Unknown card type: {card.type}</div>;
    }

    const cardTitle = AVAILABLE_CARD_TYPES.find(t => t.type === card.type)?.label || card.type;

    return (
      <DashboardCard
        key={card.id}
        id={card.id}
        title={cardTitle}
        isDragging={draggingId === card.id}
        isLocked={isLocked}
        isExpanded={card.w > 1 || card.h > 1}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={() => {}}
        onDrop={handleDrop}
        onRemove={handleRemoveCard}
        onToggleExpand={handleToggleExpand}
        className={`col-span-${card.w} row-span-${card.h}`}
      >
        {content}
      </DashboardCard>
    );
  };

  // Sort cards by position (top-to-bottom, left-to-right)
  const sortedCards = [...cards]
    .filter(c => c.visible)
    .sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {isLocked ? 'Layout is locked' : 'Drag cards to rearrange, click lock to save'}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {!isLocked && (
              <>
                <div className="relative">
                  <button
                    onClick={() => setShowAddMenu(!showAddMenu)}
                    className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Add Card
                  </button>

                  {showAddMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                      {AVAILABLE_CARD_TYPES.map(cardType => {
                        const hasCard = cards.some(c => c.type === cardType.type && c.visible);
                        return (
                          <button
                            key={cardType.type}
                            onClick={() => !hasCard && handleAddCard(cardType.type)}
                            disabled={hasCard}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${
                              hasCard ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          >
                            <span>{cardType.icon}</span>
                            <span>{cardType.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleResetLayout}
                  className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center gap-2"
                  title="Reset to default layout"
                >
                  <RotateCcw size={16} />
                  Reset
                </button>

                <button
                  onClick={handleSaveLayout}
                  disabled={saveLayoutMutation.isPending}
                  className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md"
                >
                  {saveLayoutMutation.isPending ? 'Saving...' : 'Save Layout'}
                </button>
              </>
            )}

            <button
              onClick={handleToggleLock}
              className={`p-2 rounded-md transition-colors ${
                isLocked
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
              title={isLocked ? 'Unlock dashboard' : 'Lock dashboard'}
            >
              {isLocked ? <Lock size={18} /> : <LockOpen size={18} />}
            </button>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
          {sortedCards.map(card => renderCard(card))}
        </div>

        {sortedCards.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400 mb-4">No cards to display</p>
            <button
              onClick={() => setShowAddMenu(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
            >
              Add Cards
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
