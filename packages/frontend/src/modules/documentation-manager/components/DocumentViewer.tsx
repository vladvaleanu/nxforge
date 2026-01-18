/**
 * Document Viewer Component
 * Displays document content with metadata
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ClockIcon,
  UserIcon,
  TagIcon,
  PencilIcon,
  EyeIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import { documentsApi, type Document, type DocumentVersion } from '../api/docs.api';
import { format } from 'date-fns';

interface DocumentViewerProps {
  documentId: string;
  onEdit?: (document: Document) => void;
}

export function DocumentViewer({ documentId, onEdit }: DocumentViewerProps) {
  const [showVersions, setShowVersions] = useState(false);

  // Fetch document
  const { data: documentResponse, isLoading } = useQuery({
    queryKey: ['docs-document', documentId],
    queryFn: () => documentsApi.get(documentId),
  });

  const document = documentResponse?.data;

  // Fetch versions
  const { data: versionsResponse } = useQuery({
    queryKey: ['docs-versions', documentId],
    queryFn: () => documentsApi.getVersions(documentId),
    enabled: showVersions,
  });

  const versions = versionsResponse?.data || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        Document not found
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {document.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <UserIcon className="h-4 w-4" />
                <span>{document.author.username}</span>
              </div>
              <div className="flex items-center gap-1">
                <ClockIcon className="h-4 w-4" />
                <span>
                  Updated {format(new Date(document.updated_at), 'MMM d, yyyy')}
                </span>
              </div>
              {document.status === 'PUBLISHED' && document.published_at && (
                <div className="flex items-center gap-1">
                  <EyeIcon className="h-4 w-4" />
                  <span>
                    Published {format(new Date(document.published_at), 'MMM d, yyyy')}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {document.status === 'DRAFT' && (
              <span className="px-3 py-1 text-sm rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                Draft
              </span>
            )}
            {document.status === 'ARCHIVED' && (
              <span className="px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
                Archived
              </span>
            )}
            <button
              onClick={() => onEdit?.(document)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <PencilIcon className="h-4 w-4" />
              Edit
            </button>
          </div>
        </div>

        {/* Tags */}
        {document.tags && document.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <TagIcon className="h-4 w-4 text-gray-400" />
            {document.tags.map(tag => (
              <span
                key={tag.id}
                className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                style={tag.color ? { backgroundColor: `${tag.color}20`, color: tag.color } : undefined}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          <div
            className="prose prose-gray dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: document.content_html }}
          />
        </div>
      </div>

      {/* Sidebar */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 p-4">
        <button
          onClick={() => setShowVersions(!showVersions)}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <DocumentDuplicateIcon className="h-4 w-4" />
          Version History
          {!showVersions && versions.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
              {versions.length}
            </span>
          )}
        </button>

        {showVersions && (
          <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
            {versions.map(version => (
              <div
                key={version.id}
                className="flex items-start justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Version {version.version}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {format(new Date(version.created_at), 'MMM d, yyyy HH:mm')}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    by {version.author.username}
                  </div>
                  {version.change_note && (
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {version.change_note}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
