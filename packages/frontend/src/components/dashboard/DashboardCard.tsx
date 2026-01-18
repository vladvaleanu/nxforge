/**
 * DashboardCard - Draggable card wrapper for dashboard widgets
 */

import { ReactNode, useState, DragEvent } from 'react';
import { GripVertical, X, Maximize2, Minimize2 } from 'lucide-react';

interface DashboardCardProps {
  id: string;
  title: string;
  children: ReactNode;
  isDragging?: boolean;
  isLocked?: boolean;
  isExpanded?: boolean;
  onDragStart?: (e: DragEvent<HTMLDivElement>, id: string) => void;
  onDragEnd?: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: DragEvent<HTMLDivElement>, id: string) => void;
  onRemove?: (id: string) => void;
  onToggleExpand?: (id: string) => void;
  className?: string;
}

export function DashboardCard({
  id,
  title,
  children,
  isDragging = false,
  isLocked = false,
  isExpanded = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onRemove,
  onToggleExpand,
  className = '',
}: DashboardCardProps) {
  const [isOver, setIsOver] = useState(false);

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    if (isLocked) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(e, id);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (isLocked) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsOver(true);
    onDragOver?.(e);
  };

  const handleDragLeave = () => {
    setIsOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    if (isLocked) return;
    e.preventDefault();
    setIsOver(false);
    onDrop?.(e, id);
  };

  return (
    <div
      draggable={!isLocked}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700
        transition-all duration-200
        ${isDragging ? 'opacity-50 scale-95' : ''}
        ${isOver ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900' : ''}
        ${!isLocked ? 'cursor-grab active:cursor-grabbing' : ''}
        ${isExpanded ? 'col-span-2 row-span-2' : ''}
        ${className}
      `}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {!isLocked && (
            <GripVertical size={16} className="text-gray-400 dark:text-gray-500" />
          )}
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">{title}</h3>
        </div>
        <div className="flex items-center gap-1">
          {onToggleExpand && (
            <button
              onClick={() => onToggleExpand(id)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title={isExpanded ? 'Minimize' : 'Expand'}
            >
              {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          )}
          {onRemove && !isLocked && (
            <button
              onClick={() => onRemove(id)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500"
              title="Remove card"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

export default DashboardCard;
