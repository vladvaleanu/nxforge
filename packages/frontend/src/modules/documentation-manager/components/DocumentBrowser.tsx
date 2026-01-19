import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FolderIcon,
  DocumentTextIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  TrashIcon,
  ArrowPathIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  FolderPlusIcon
} from '@heroicons/react/24/outline';
import {
  documentsApi,
  foldersApi,
  categoriesApi,
  DocumentListItem,
  Folder
} from '../api/docs.api';
import { showSuccess, showError } from '../../../utils/toast.utils';
import ConfirmModal from '../../../components/ConfirmModal';

interface DocumentBrowserProps {
  onSelectDocument?: (document: DocumentListItem) => void;
  onSelectFolder?: (folder: Folder) => void;
  selectedDocumentId?: string;
  onDocumentDeleted?: (id: string) => void;
}

export default function DocumentBrowser({
  onSelectDocument,
  onSelectFolder,
  selectedDocumentId,
  onDocumentDeleted
}: DocumentBrowserProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'browser' | 'trash'>('browser');
  const queryClient = useQueryClient();

  const [confirmation, setConfirmation] = useState<{
    isOpen: boolean;
    type: 'delete' | 'restore' | 'permanent-delete' | 'delete-folder' | null;
    documentId: string | null;
    documentTitle: string | null;
  }>({
    isOpen: false,
    type: null,
    documentId: null,
    documentTitle: null,
  });

  // Folder modal state
  const [folderModal, setFolderModal] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    folder: Folder | null;
  }>({
    isOpen: false,
    mode: 'create',
    folder: null,
  });
  const [folderName, setFolderName] = useState('');

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['docs-categories'],
    queryFn: async () => {
      const response = await categoriesApi.list();
      return response.data || [];
    }
  });

  // Initialize selected category when categories load
  useEffect(() => {
    if (categories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  // Fetch folders for selected category
  const { data: folders = [] } = useQuery({
    queryKey: ['docs-folders', selectedCategoryId],
    queryFn: async () => {
      const response = await foldersApi.list(selectedCategoryId);
      return response.data || [];
    },
    enabled: !!selectedCategoryId && viewMode === 'browser'
  });

  // Fetch documents - different queries for browser vs trash
  const { data: documents = [] } = useQuery({
    queryKey: ['docs-documents', viewMode === 'trash' ? 'trash' : selectedCategoryId, searchQuery],
    queryFn: async () => {
      const response = await documentsApi.list({
        categoryId: viewMode === 'trash' ? undefined : selectedCategoryId,
        search: searchQuery || undefined,
        trashed: viewMode === 'trash'
      });
      if (Array.isArray(response)) return response;
      return response.data || [];
    },
    enabled: viewMode === 'trash' || !!selectedCategoryId
  });

  // Mutations with proper cache invalidation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['docs-documents'] });
      queryClient.invalidateQueries({ queryKey: ['docs-folders'] });
      queryClient.invalidateQueries({ queryKey: ['docs-categories'] });
      onDocumentDeleted?.(deletedId);
      showSuccess('Document moved to trash');
    },
    onError: (error: Error) => {
      showError(`Failed to delete document: ${error.message}`);
    }
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => documentsApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docs-documents'] });
      queryClient.invalidateQueries({ queryKey: ['docs-folders'] });
      queryClient.invalidateQueries({ queryKey: ['docs-categories'] });
      showSuccess('Document restored successfully');
    },
    onError: (error: Error) => {
      showError(`Failed to restore document: ${error.message}`);
    }
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.permanentDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docs-documents'] });
      queryClient.invalidateQueries({ queryKey: ['docs-folders'] });
      queryClient.invalidateQueries({ queryKey: ['docs-categories'] });
      showSuccess('Document permanently deleted');
    },
    onError: (error: Error) => {
      showError(`Failed to delete document: ${error.message}`);
    }
  });

  // Folder mutations
  const createFolderMutation = useMutation({
    mutationFn: (data: { name: string; categoryId: string; parentId?: string }) =>
      foldersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docs-folders', selectedCategoryId] });
      showSuccess('Folder created successfully');
      closeFolderModal();
    },
    onError: (error: Error) => {
      showError(`Failed to create folder: ${error.message}`);
    }
  });

  const updateFolderMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string } }) =>
      foldersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docs-folders', selectedCategoryId] });
      showSuccess('Folder updated successfully');
      closeFolderModal();
    },
    onError: (error: Error) => {
      showError(`Failed to update folder: ${error.message}`);
    }
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => foldersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docs-folders', selectedCategoryId] });
      queryClient.invalidateQueries({ queryKey: ['docs-documents'] });
      showSuccess('Folder deleted successfully');
    },
    onError: (error: Error) => {
      showError(`Failed to delete folder: ${error.message}`);
    }
  });

  // Folder modal handlers
  const openCreateFolderModal = () => {
    setFolderName('');
    setFolderModal({ isOpen: true, mode: 'create', folder: null });
  };

  const openEditFolderModal = (folder: Folder, e: React.MouseEvent) => {
    e.stopPropagation();
    setFolderName(folder.name);
    setFolderModal({ isOpen: true, mode: 'edit', folder });
  };

  const closeFolderModal = () => {
    setFolderModal({ isOpen: false, mode: 'create', folder: null });
    setFolderName('');
  };

  const handleFolderSubmit = () => {
    if (!folderName.trim()) return;

    if (folderModal.mode === 'create') {
      createFolderMutation.mutate({ name: folderName.trim(), categoryId: selectedCategoryId });
    } else if (folderModal.folder) {
      updateFolderMutation.mutate({ id: folderModal.folder.id, data: { name: folderName.trim() } });
    }
  };

  const handleDeleteFolder = (e: React.MouseEvent, folderId: string, folderName: string) => {
    e.stopPropagation();
    setConfirmation({
      isOpen: true,
      type: 'delete-folder',
      documentId: folderId,
      documentTitle: folderName,
    });
  };

  const handleDelete = (e: React.MouseEvent, docId: string, docTitle: string) => {
    e.stopPropagation();
    setConfirmation({
      isOpen: true,
      type: 'delete',
      documentId: docId,
      documentTitle: docTitle,
    });
  };

  const handleRestore = (e: React.MouseEvent, docId: string, docTitle: string) => {
    e.stopPropagation();
    setConfirmation({
      isOpen: true,
      type: 'restore',
      documentId: docId,
      documentTitle: docTitle,
    });
  };

  const handlePermanentDelete = (e: React.MouseEvent, docId: string, docTitle: string) => {
    e.stopPropagation();
    setConfirmation({
      isOpen: true,
      type: 'permanent-delete',
      documentId: docId,
      documentTitle: docTitle,
    });
  };

  const executeConfirmation = () => {
    if (!confirmation.documentId) return;

    switch (confirmation.type) {
      case 'delete':
        deleteMutation.mutate(confirmation.documentId);
        break;
      case 'restore':
        restoreMutation.mutate(confirmation.documentId);
        break;
      case 'permanent-delete':
        permanentDeleteMutation.mutate(confirmation.documentId);
        break;
      case 'delete-folder':
        deleteFolderMutation.mutate(confirmation.documentId);
        break;
    }
    closeConfirmation();
  };

  const closeConfirmation = () => {
    setConfirmation({
      isOpen: false,
      type: null,
      documentId: null,
      documentTitle: null,
    });
  };

  const getModalProps = () => {
    switch (confirmation.type) {
      case 'delete':
        return {
          title: 'Move to Trash?',
          message: `Are you sure you want to move "${confirmation.documentTitle}" to trash? You can restore it later.`,
          confirmText: 'Move to Trash',
          variant: 'warning' as const,
        };
      case 'restore':
        return {
          title: 'Restore Document?',
          message: `Are you sure you want to restore "${confirmation.documentTitle}" from trash?`,
          confirmText: 'Restore',
          variant: 'info' as const,
        };
      case 'permanent-delete':
        return {
          title: 'Permanently Delete?',
          message: `Are you sure you want to permanently delete "${confirmation.documentTitle}"? This action CANNOT be undone.`,
          confirmText: 'Delete Forever',
          variant: 'danger' as const,
        };
      case 'delete-folder':
        return {
          title: 'Delete Folder?',
          message: `Are you sure you want to delete the folder "${confirmation.documentTitle}"? Documents inside will be moved to root level.`,
          confirmText: 'Delete Folder',
          variant: 'warning' as const,
        };
      default:
        return {
          title: '',
          message: '',
          confirmText: '',
          variant: 'info' as const,
        };
    }
  };

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
          <span className="text-xs text-gray-400 group-hover:hidden">
            {folder.document_count || 0}
          </span>
          <div className="hidden group-hover:flex items-center gap-0.5">
            <button
              onClick={(e) => openEditFolderModal(folder, e)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              title="Edit Folder"
            >
              <PencilIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => handleDeleteFolder(e, folder.id, folder.name)}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title="Delete Folder"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {isExpanded && (
          <div>
            {folder.children?.map(child => renderFolder(child, level + 1))}
            {folderDocs.map(doc => (
              <div
                key={doc.id}
                className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer rounded-lg group ${selectedDocumentId === doc.id
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'text-gray-700 dark:text-gray-300'
                  }`}
                style={{ paddingLeft: `${32 + (level + 1) * 20}px` }}
                onClick={() => onSelectDocument?.(doc)}
              >
                <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                <span className="flex-1 text-sm truncate">
                  {doc.title}
                </span>
                {doc.status === 'DRAFT' && (
                  <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                    Draft
                  </span>
                )}
                {doc.status === 'ARCHIVED' && (
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    Archived
                  </span>
                )}
                <button
                  onClick={(e) => handleDelete(e, doc.id, doc.title)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-all"
                  title="Delete Document"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderTrashItem = (doc: DocumentListItem) => (
    <div
      key={doc.id}
      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg group text-gray-700 dark:text-gray-300"
    >
      <DocumentTextIcon className="h-5 w-5 text-gray-400" />
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{doc.title}</p>
        <p className="text-xs text-gray-400">Deleted {new Date(doc.updated_at).toLocaleDateString()}</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => handleRestore(e, doc.id, doc.title)}
          className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-gray-400 hover:text-green-600 dark:hover:text-green-400"
          title="Restore"
        >
          <ArrowPathIcon className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => handlePermanentDelete(e, doc.id, doc.title)}
          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400"
          title="Delete Permanently"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  const rootDocuments = documents.filter(d => !d.folder_id);

  // Group trash documents by category
  const trashGroups = viewMode === 'trash' ? Object.values(documents.reduce((acc, doc) => {
    // Backend listDocuments might not return root category_id, but returns category object
    const catId = doc.category?.id || doc.category_id || 'uncategorized';
    if (!acc[catId]) {
      acc[catId] = {
        id: catId,
        name: doc.category?.name || 'Uncategorized',
        docs: []
      };
    }
    acc[catId].docs.push(doc);
    return acc;
  }, {} as Record<string, { id: string, name: string, docs: DocumentListItem[] }>))
    .sort((a: { id: string, name: string }, b: { id: string, name: string }) => {
      const catA = categories.find(c => c.id === a.id);
      const catB = categories.find(c => c.id === b.id);
      // Sort by defined category order first, then alphabetical for others
      if (catA && catB) return (catA.order || 0) - (catB.order || 0);
      if (catA) return -1;
      if (catB) return 1;
      return a.name.localeCompare(b.name);
    }) : [];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      {/* Category list */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800">
        <div className="p-2 space-y-0.5">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => {
                setSelectedCategoryId(category.id);
                setViewMode('browser');
              }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'browser' && selectedCategoryId === category.id
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
            >
              <span className="flex-1 text-left truncate">{category.name}</span>
              <span className="text-xs px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500">
                {category.document_count || 0}
              </span>
            </button>
          ))}

          <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

          <button
            onClick={() => setViewMode('trash')}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'trash'
              ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
          >
            <TrashIcon className="h-4 w-4" />
            <span className="flex-1 text-left">Trash</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 p-3 border-b border-gray-200 dark:border-gray-800">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={viewMode === 'trash' ? "Search trash..." : "Search documents..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* New Folder Button - only in browser mode */}
      {viewMode === 'browser' && selectedCategoryId && (
        <div className="flex-shrink-0 px-3 pb-2">
          <button
            onClick={openCreateFolderModal}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg transition-colors"
          >
            <FolderPlusIcon className="h-4 w-4" />
            New Folder
          </button>
        </div>
      )}

      {/* Document Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {viewMode === 'trash' ? (
          <div className="space-y-6">
            {documents.length > 0 ? (
              trashGroups.map((group: { id: string, name: string, docs: DocumentListItem[] }) => (
                <div key={group.id}>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-3">
                    {group.name}
                  </h3>
                  <div className="space-y-1">
                    {group.docs.map(renderTrashItem)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                Trash is empty
              </div>
            )}
          </div>
        ) : (
          <>
            {folders.map(folder => renderFolder(folder))}
            {rootDocuments.length > 0 && rootDocuments.map(doc => (
              <div
                key={doc.id}
                className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer rounded-lg group ${selectedDocumentId === doc.id
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'text-gray-700 dark:text-gray-300'
                  }`}
                onClick={() => onSelectDocument?.(doc)}
              >
                <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                <span className="flex-1 text-sm truncate">{doc.title}</span>
                {doc.status === 'DRAFT' && (
                  <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                    Draft
                  </span>
                )}
                {doc.status === 'ARCHIVED' && (
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    Archived
                  </span>
                )}
                <button
                  onClick={(e) => handleDelete(e, doc.id, doc.title)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-all"
                  title="Delete Document"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
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
          </>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmation.isOpen}
        onClose={closeConfirmation}
        onConfirm={executeConfirmation}
        isLoading={deleteMutation.isPending || restoreMutation.isPending || permanentDeleteMutation.isPending || deleteFolderMutation.isPending}
        {...getModalProps()}
      />

      {/* Folder Modal */}
      {folderModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              {folderModal.mode === 'create' ? 'New Folder' : 'Edit Folder'}
            </h3>
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Folder name"
              autoFocus
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFolderSubmit();
                if (e.key === 'Escape') closeFolderModal();
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={closeFolderModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleFolderSubmit}
                disabled={!folderName.trim() || createFolderMutation.isPending || updateFolderMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {createFolderMutation.isPending || updateFolderMutation.isPending ? 'Saving...' : (folderModal.mode === 'create' ? 'Create' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
