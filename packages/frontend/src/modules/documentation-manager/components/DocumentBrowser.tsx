/**
 * Document Browser Component
 * Hierarchical view of categories, folders, and documents
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FolderIcon,
  DocumentTextIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  PlusIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { categoriesApi, foldersApi, documentsApi, type Category, type Folder, type DocumentListItem } from '../api/docs.api';

interface DocumentBrowserProps {
  onSelectDocument?: (document: DocumentListItem) => void;
  onSelectFolder?: (folder: Folder) => void;
  selectedDocumentId?: string;
}

export function DocumentBrowser({ onSelectDocument, onSelectFolder, selectedDocumentId }: DocumentBrowserProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch categories
  const { data: categoriesResponse } = useQuery({
    queryKey: ['docs-categories'],
    queryFn: () => categoriesApi.list(),
  });

  const categories = categoriesResponse?.data || [];

  // Fetch folders for selected category
  const { data: foldersResponse } = useQuery({
    queryKey: ['docs-folders', selectedCategoryId],
    queryFn: () => foldersApi.list(selectedCategoryId!),
    enabled: !!selectedCategoryId,
  });

  const folders = foldersResponse?.data || [];

  // Fetch documents for selected category
  const { data: documentsResponse } = useQuery({
    queryKey: ['docs-documents', selectedCategoryId, searchQuery],
    queryFn: () => documentsApi.list({
      categoryId: selectedCategoryId!,
      search: searchQuery || undefined,
    }),
    enabled: !!selectedCategoryId,
  });

  const documents = documentsResponse?.data || [];

  // Select first category by default
  useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const renderFolder = (folder: Folder, level: number = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const folderDocs = documents.filter(d => d.folder_id === folder.id);

    return (
      <div key={folder.id}>
        <div
          className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer rounded-lg group"
          style={{ paddingLeft: `${12 + level * 20}px` }}
          onClick={() => {
            toggleFolder(folder.id);
            onSelectFolder?.(folder);
          }}
        >
          <button
            className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            onClick={(e) => {
              e.stopPropagation();
              toggleFolder(folder.id);
            }}
          >
            {isExpanded ? (
              <ChevronDownIcon className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 text-gray-500" />
            )}
          </button>
          <FolderIcon className="h-5 w-5 text-yellow-500" />
          <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            {folder.name}
          </span>
          <span className="text-xs text-gray-400">
            {folder.document_count || 0}
          </span>
        </div>

        {isExpanded && (
          <div>
            {folder.children?.map(child => renderFolder(child, level + 1))}
            {folderDocs.map(doc => (
              <div
                key={doc.id}
                className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer rounded-lg ${
                  selectedDocumentId === doc.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
                style={{ paddingLeft: `${32 + (level + 1) * 20}px` }}
                onClick={() => onSelectDocument?.(doc)}
              >
                <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                  {doc.title}
                </span>
                {doc.status === 'DRAFT' && (
                  <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                    Draft
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Documents without folder
  const rootDocuments = documents.filter(d => !d.folder_id);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      {/* Category list */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800">
        <div className="p-2 space-y-0.5">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setSelectedCategoryId(category.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                selectedCategoryId === category.id
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <span className="flex-1 text-left truncate">{category.name}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-md font-normal ${
                selectedCategoryId === category.id
                  ? 'bg-blue-100 dark:bg-blue-800/30 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500'
              }`}>
                {category.document_count || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 p-3 border-b border-gray-200 dark:border-gray-800">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Document tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {folders.map(folder => renderFolder(folder))}

        {rootDocuments.length > 0 && (
          <div className="mt-2">
            {rootDocuments.map(doc => (
              <div
                key={doc.id}
                className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer rounded-lg ${
                  selectedDocumentId === doc.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
                onClick={() => onSelectDocument?.(doc)}
              >
                <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                  {doc.title}
                </span>
                {doc.status === 'DRAFT' && (
                  <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                    Draft
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {documents.length === 0 && !searchQuery && (
          <div className="text-center py-8 text-gray-400 text-sm">
            No documents yet
          </div>
        )}

        {documents.length === 0 && searchQuery && (
          <div className="text-center py-8 text-gray-400 text-sm">
            No documents found
          </div>
        )}
      </div>
    </div>
  );
}
