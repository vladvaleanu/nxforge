/**
 * Media Gallery Component
 * Browse and manage all media files across all documents
 */

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpTrayIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  PhotoIcon,
  DocumentIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { attachmentsApi, type Attachment } from '../api/docs.api';
import { AuthenticatedImage } from './AuthenticatedImage';
import { MediaPreviewModal } from './MediaPreviewModal';

interface MediaGalleryProps {
  onSelectMedia?: (attachment: Attachment) => void;
  selectionMode?: boolean;
}

export function MediaGallery({ onSelectMedia, selectionMode = false }: MediaGalleryProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<Attachment | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Fetch all attachments from global media library
  const { data: attachmentsResponse, isLoading } = useQuery({
    queryKey: ['docs-all-attachments', searchQuery],
    queryFn: () => attachmentsApi.listAll(searchQuery),
  });

  const attachments = attachmentsResponse?.data || [];

  // Upload mutation for standalone media
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploading(true);
      const response = await attachmentsApi.uploadStandalone(file);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docs-all-attachments'] });
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (error: Error) => {
      setUploading(false);
      alert(`Upload failed: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) => attachmentsApi.delete(attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docs-all-attachments'] });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const filteredAttachments = attachments;

  const isImage = (mimetype: string) => mimetype.startsWith('image/');

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Media Library
          </h2>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              disabled={uploading}
            >
              <ArrowUpTrayIcon className="h-4 w-4" />
              Upload Media
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search media files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Media Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">Loading media...</div>
          </div>
        ) : filteredAttachments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <PhotoIcon className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg mb-2">No media files yet</p>
            <p className="text-sm text-center max-w-md">
              Upload images and files by clicking "Upload Media" above
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredAttachments.map((attachment) => (
              <div
                key={attachment.id}
                className={`group relative rounded-lg border-2 transition-all cursor-pointer ${
                  selectedFile?.id === attachment.id
                    ? 'border-blue-500 dark:border-blue-400'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
                onClick={() => {
                  if (selectionMode) {
                    setSelectedFile(attachment);
                    onSelectMedia?.(attachment);
                  } else {
                    setPreviewAttachment(attachment);
                    setIsPreviewOpen(true);
                  }
                }}
              >
                {/* Preview */}
                <div className="aspect-square rounded-t-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                  {isImage(attachment.mimetype) ? (
                    <AuthenticatedImage
                      src={attachmentsApi.getDownloadUrl(attachment.id)}
                      alt={attachment.filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <DocumentIcon className="h-12 w-12 text-gray-400" />
                  )}
                </div>

                {/* Info */}
                <div className="p-2">
                  <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                    {attachment.filename}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(attachment.size / 1024).toFixed(1)} KB
                  </p>
                </div>

                {/* Actions */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete ${attachment.filename}?`)) {
                        deleteMutation.mutate(attachment.id);
                      }
                    }}
                    className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-lg"
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selection Mode Footer */}
      {selectionMode && selectedFile && (
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                {isImage(selectedFile.mimetype) ? (
                  <AuthenticatedImage
                    src={attachmentsApi.getDownloadUrl(selectedFile.id)}
                    alt={selectedFile.filename}
                    className="w-full h-full object-cover rounded"
                  />
                ) : (
                  <DocumentIcon className="h-6 w-6 text-gray-400" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {selectedFile.filename}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedFile(null)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <MediaPreviewModal
        attachment={previewAttachment}
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewAttachment(null);
        }}
        onDelete={(attachmentId) => {
          deleteMutation.mutate(attachmentId);
        }}
      />
    </div>
  );
}
