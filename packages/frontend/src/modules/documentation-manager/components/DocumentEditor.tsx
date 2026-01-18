/**
 * Document Editor Component
 * Markdown editor with preview
 */

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  XMarkIcon,
  EyeIcon,
  CodeBracketIcon,
  DocumentCheckIcon,
} from '@heroicons/react/24/outline';
import { documentsApi, categoriesApi, foldersApi, type Document, type CreateDocumentData, type UpdateDocumentData } from '../api/docs.api';
import { RichTextEditor } from './RichTextEditor';

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
  const [editorMode, setEditorMode] = useState<'markdown' | 'wysiwyg'>('markdown');

  // Fetch document if editing
  const { data: documentResponse } = useQuery({
    queryKey: ['docs-document', documentId],
    queryFn: () => documentsApi.get(documentId!),
    enabled: isEditMode,
  });

  const document = documentResponse?.data;

  // Fetch categories
  const { data: categoriesResponse } = useQuery({
    queryKey: ['docs-categories'],
    queryFn: () => categoriesApi.list(),
  });

  const categories = categoriesResponse?.data || [];

  // Fetch folders for selected category
  const { data: foldersResponse } = useQuery({
    queryKey: ['docs-folders', categoryId],
    queryFn: () => foldersApi.list(categoryId),
    enabled: !!categoryId,
  });

  const folders = foldersResponse?.data || [];

  // Populate form when editing
  useEffect(() => {
    if (document) {
      setTitle(document.title);
      setContent(document.content);
      setCategoryId(document.category_id);
      setFolderId(document.folder_id || '');
      setStatus(document.status);
      setTags(document.tags?.map(t => t.name) || []);
    } else if (categories.length > 0 && !categoryId) {
      setCategoryId(categories[0].id);
    }
  }, [document, categories, categoryId]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateDocumentData) => documentsApi.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['docs-documents'] });
      onSave?.(response.data);
      onClose();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateDocumentData) => documentsApi.update(documentId!, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['docs-documents'] });
      queryClient.invalidateQueries({ queryKey: ['docs-document', documentId] });
      onSave?.(response.data);
      onClose();
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
        folderId: folderId || undefined,
        status,
        tags,
        changeNote: changeNote || undefined,
      });
    } else {
      createMutation.mutate({
        title,
        content,
        categoryId,
        folderId: folderId || undefined,
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
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  editorMode === 'markdown'
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
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  editorMode === 'wysiwyg'
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
            <button
              onClick={handleSave}
              disabled={!title.trim() || !content.trim() || !categoryId || createMutation.isPending || updateMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <DocumentCheckIcon className="h-4 w-4" />
              {isEditMode ? 'Update' : 'Create'}
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
                onChange={(e) => setTitle(e.target.value)}
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
                  onChange={(e) => setFolderId(e.target.value)}
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
                      onChange={(e) => setStatus(e.target.value as typeof status)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{s}</span>
                  </label>
                ))}
              </div>
            </div>

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
                  onChange={setContent}
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
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your document in Markdown..."
                  rows={20}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
