/**
 * Documentation Manager Page
 * Main page for browsing and managing documents
 */

import { useState } from 'react';
import { PlusIcon, PhotoIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { DocumentBrowser } from '../components/DocumentBrowser';
import { DocumentViewer } from '../components/DocumentViewer';
import { DocumentEditor } from '../components/DocumentEditor';
import { MediaGallery } from '../components/MediaGallery';
import type { Document, DocumentListItem } from '../api/docs.api';

type ViewMode = 'documents' | 'media';

export function DocumentationPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('documents');
  const [selectedDocument, setSelectedDocument] = useState<DocumentListItem | null>(null);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const handleSelectDocument = (document: DocumentListItem) => {
    setSelectedDocument(document);
  };

  const handleCreateDocument = () => {
    setEditingDocument(null);
    setShowEditor(true);
  };

  const handleEditDocument = (document: Document) => {
    setEditingDocument(document);
    setShowEditor(true);
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
    setEditingDocument(null);
  };

  const handleSaveDocument = (document: Document) => {
    setSelectedDocument(document);
    setShowEditor(false);
    setEditingDocument(null);
  };

  return (
    <div className="flex h-full">
      {/* Sidebar - Document Browser (only show in documents view) */}
      {viewMode === 'documents' && (
        <div className="w-80 flex-shrink-0">
          <DocumentBrowser
            onSelectDocument={handleSelectDocument}
            selectedDocumentId={selectedDocument?.id}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Documentation
            </h1>
            {viewMode === 'documents' && (
              <button
                onClick={handleCreateDocument}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                New Document
              </button>
            )}
          </div>

          {/* View Mode Tabs */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('documents')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                viewMode === 'documents'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <DocumentTextIcon className="h-4 w-4" />
              Documents
            </button>
            <button
              onClick={() => setViewMode('media')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                viewMode === 'media'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <PhotoIcon className="h-4 w-4" />
              Media
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'documents' ? (
            selectedDocument ? (
              <DocumentViewer
                documentId={selectedDocument.id}
                onEdit={handleEditDocument}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <p className="text-lg mb-2">No document selected</p>
                  <p className="text-sm">Select a document from the sidebar or create a new one</p>
                </div>
              </div>
            )
          ) : (
            <MediaGallery />
          )}
        </div>
      </div>

      {/* Document Editor Modal */}
      {showEditor && (
        <DocumentEditor
          documentId={editingDocument?.id}
          onClose={handleCloseEditor}
          onSave={handleSaveDocument}
        />
      )}
    </div>
  );
}

export default DocumentationPage;
