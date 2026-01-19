/**
 * Document Editor Component
 * Markdown editor with preview
 */

import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  XMarkIcon,
  EyeIcon,
  CodeBracketIcon,
  DocumentCheckIcon,
  SparklesIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { documentsApi, categoriesApi, foldersApi, type Document, type CreateDocumentData, type UpdateDocumentData } from '../api/docs.api';
import { RichTextEditor } from './RichTextEditor';
import { DocumentHistory } from './DocumentHistory';
import { showError } from '../../../utils/toast.utils';

interface DocumentEditorProps {
  documentId?: string;
  onClose: () => void;
  onSave?: (document: Document) => void;
}

export function DocumentEditor({ documentId, onClose, onSave }: DocumentEditorProps) {
  const queryClient = useQueryClient();
  const isEditMode = !!documentId;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [folderId, setFolderId] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED' | 'ARCHIVED'>('DRAFT');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [editorMode, setEditorMode] = useState<'markdown' | 'wysiwyg'>('wysiwyg');
  const [aiAccessible, setAiAccessible] = useState(false);
  const [hasEmbedding, setHasEmbedding] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isDirty, setIsDirty] = useState(!isEditMode); // New docs start dirty, edits start clean
  const [creationSuccess, setCreationSuccess] = useState(false);
  const isInitialLoad = useRef(isEditMode); // Track if we're still loading in edit mode

  // Safe setter that respects initial load
  const markDirty = () => {
    if (!isInitialLoad.current) {
      setIsDirty(true);
    }
  };

  // Fetch document if editing
  const { data: documentResponse } = useQuery({
    queryKey: ['docs-document', documentId],
    queryFn: () => documentsApi.get(documentId!),
    enabled: isEditMode,
  });

  const document = documentResponse?.data;

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['docs-categories'],
    queryFn: async () => {
      const response = await categoriesApi.list();
      return response.data || [];
    }
  });

  // Fetch folders for selected category
  const { data: folders = [] } = useQuery({
    queryKey: ['docs-folders', categoryId],
    queryFn: async () => {
      const response = await foldersApi.list(categoryId);
      return response.data || [];
    },
    enabled: !!categoryId,
  });

  // Fetch AI access status if editing
  const { data: aiAccessResponse } = useQuery({
    queryKey: ['docs-ai-access', documentId],
    queryFn: () => documentsApi.getAiAccess(documentId!),
    enabled: isEditMode,
    refetchInterval: aiAccessible && !hasEmbedding ? 2000 : false,
  });

  // AI access toggle mutation
  const aiAccessMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      documentsApi.setAiAccess(id, enabled),
    onSuccess: (response) => {
      setAiAccessible(response.data.aiAccessible);
      queryClient.invalidateQueries({ queryKey: ['docs-ai-access', documentId] });
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (document) {
      setTitle(document.title);
      setContent(document.content);
      setCategoryId(document.category_id);
      setFolderId(document.folder_id || '');
      setStatus(document.status);
      setTags(document.tags?.map(t => t.name) || []);
      // Reset dirty state after loading document data
      setIsDirty(false);
      // Clear initial load flag after a short delay to allow editors to initialize
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 500);
    }
  }, [document]);

  // Initialize category for new documents only
  useEffect(() => {
    if (!isEditMode && categories.length > 0 && !categoryId) {
      setCategoryId(categories[0].id);
    }
  }, [isEditMode, categories, categoryId]);

  // Populate AI access state
  useEffect(() => {
    if (aiAccessResponse?.data) {
      setAiAccessible(aiAccessResponse.data.aiAccessible);
      setHasEmbedding(aiAccessResponse.data.hasEmbedding);
    }
  }, [aiAccessResponse]);

  const handleAiAccessToggle = () => {
    if (!documentId) return;
    aiAccessMutation.mutate({ id: documentId, enabled: !aiAccessible });
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateDocumentData) => documentsApi.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['docs-documents'] });
      queryClient.invalidateQueries({ queryKey: ['docs-folders'] });
      queryClient.invalidateQueries({ queryKey: ['docs-categories'] });
      // Keep popup open after create
      setIsDirty(false);
      setCreationSuccess(true);
      setTimeout(() => setCreationSuccess(false), 3000);
      onSave?.(response.data);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to create document';
      showError(message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateDocumentData) => documentsApi.update(documentId!, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['docs-documents'] });
      queryClient.invalidateQueries({ queryKey: ['docs-folders'] });
      queryClient.invalidateQueries({ queryKey: ['docs-categories'] });
      queryClient.invalidateQueries({ queryKey: ['docs-document', documentId] });
      queryClient.invalidateQueries({ queryKey: ['docs-versions', documentId] });
      // Don't close - keep popup open
      setIsDirty(false);
      setChangeNote(''); // Clear change note after save
      onSave?.(response.data);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to update document';
      showError(message);
    },
  });

  const handleSave = () => {
    if (!title.trim() || !content.trim() || !categoryId) {
      return;
    }

    if (isEditMode) {
      updateMutation.mutate({
        title,
        content,
        categoryId,
        folderId: folderId || null,
        status,
        tags,
        changeNote: changeNote || undefined,
      });
    } else {
      createMutation.mutate({
        title,
        content,
        categoryId,
        folderId: folderId || null,
        status,
        tags,
      });
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const renderPreview = () => {
    // Basic markdown to HTML conversion for preview
    let html = content;

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold mt-6 mb-3">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-8 mb-4">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mt-8 mb-4">$1</h1>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong class="font-bold">$1</strong>');

    // Italic
    html = html.replace(/\*(.*?)\*/gim, '<em class="italic">$1</em>');

    // Code blocks
    html = html.replace(/```(.*?)```/gis, '<pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg my-4 overflow-x-auto"><code>$1</code></pre>');

    // Inline code
    html = html.replace(/`(.*?)`/gim, '<code class="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm">$1</code>');

    // Links
    html = html.replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" class="text-blue-600 dark:text-blue-400 hover:underline">$1</a>');

    // Lists
    html = html.replace(/^\* (.*$)/gim, '<li class="ml-4">$1</li>');
    html = html.replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>');

    // Paragraphs
    html = html.replace(/\n\n/g, '</p><p class="mb-4">');
    html = '<p class="mb-4">' + html + '</p>';

    return html;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {isEditMode ? 'Edit Document' : 'New Document'}
          </h2>
          <div className="flex items-center gap-2">
            {/* Editor Mode Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => {
                  setEditorMode('markdown');
                  setShowPreview(false);
                }}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${editorMode === 'markdown'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
                  }`}
              >
                Markdown
              </button>
              <button
                onClick={() => {
                  setEditorMode('wysiwyg');
                  setShowPreview(false);
                }}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${editorMode === 'wysiwyg'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
                  }`}
              >
                WYSIWYG
              </button>
            </div>

            {/* Preview toggle (only for Markdown mode) */}
            {editorMode === 'markdown' && (
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                {showPreview ? (
                  <>
                    <CodeBracketIcon className="h-4 w-4" />
                    Edit
                  </>
                ) : (
                  <>
                    <EyeIcon className="h-4 w-4" />
                    Preview
                  </>
                )}
              </button>
            )}

            {/* History Button (Edit Mode Only) */}
            {isEditMode && (
              <button
                onClick={() => setShowHistory(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                title="Version History"
              >
                <ClockIcon className="h-5 w-5" />
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={!title.trim() || !content.trim() || !categoryId || createMutation.isPending || updateMutation.isPending || (isEditMode && !isDirty) || creationSuccess}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${creationSuccess
                ? 'bg-green-600 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
                }`}
            >
              {creationSuccess ? (
                <>
                  <DocumentCheckIcon className="h-4 w-4" />
                  Created
                </>
              ) : (
                <>
                  <DocumentCheckIcon className="h-4 w-4" />
                  {isEditMode ? (isDirty ? 'Update' : 'Saved') : 'Create'}
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); markDirty(); }}
                placeholder="Document title"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Category and Folder */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setFolderId('');
                    markDirty();
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Folder (Optional)
                </label>
                <select
                  value={folderId}
                  onChange={(e) => { setFolderId(e.target.value); markDirty(); }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!categoryId || folders.length === 0}
                >
                  <option value="">No folder</option>
                  {folders.map(folder => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <div className="flex gap-4">
                {(['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const).map(s => (
                  <label key={s} className="flex items-center gap-2">
                    <input
                      type="radio"
                      value={s}
                      checked={status === s}
                      onChange={(e) => { setStatus(e.target.value as typeof status); markDirty(); }}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{s}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Forge AI Access (edit mode only) */}
            {isEditMode && status === 'PUBLISHED' && (
              <div className="border border-purple-200 dark:border-purple-800 rounded-lg p-4 bg-purple-50 dark:bg-purple-900/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <SparklesIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Forge AI Access
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Allow Forge to read this document for context-aware responses
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {aiAccessible && (
                      <span className={`text-xs px-2 py-1 rounded-full ${hasEmbedding
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                        {hasEmbedding ? 'Indexed' : 'Indexing...'}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleAiAccessToggle}
                      disabled={aiAccessMutation.isPending}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${aiAccessible ? 'bg-purple-600' : 'bg-gray-200 dark:bg-gray-700'
                        } ${aiAccessMutation.isPending ? 'opacity-50 cursor-wait' : ''}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${aiAccessible ? 'translate-x-5' : 'translate-x-0'
                          }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tags
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  placeholder="Add tag"
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleAddTag}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-3 py-1 text-sm rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-red-600"
                    >
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Change Note (edit mode only) */}
            {isEditMode && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Change Note (Optional)
                </label>
                <input
                  type="text"
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                  placeholder="Describe your changes"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Content
              </label>
              {editorMode === 'wysiwyg' ? (
                <RichTextEditor
                  content={content}
                  onChange={(val) => { setContent(val); markDirty(); }}
                  placeholder="Start writing your document..."
                  documentId={documentId}
                />
              ) : showPreview ? (
                <div
                  className="min-h-[400px] p-4 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 prose prose-gray dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderPreview() }}
                />
              ) : (
                <textarea
                  value={content}
                  onChange={(e) => { setContent(e.target.value); markDirty(); }}
                  placeholder="Write your document in Markdown..."
                  rows={20}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {showHistory && documentId && (
        <DocumentHistory
          documentId={documentId}
          onClose={() => setShowHistory(false)}
          onRestore={() => {
            // Document will automatically refresh via query invalidation
            // But we should also close the history modal
            setShowHistory(false);
          }}
        />
      )}
    </div>
  );
}
