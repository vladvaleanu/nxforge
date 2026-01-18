/**
 * Media Browser Component
 * Browse, upload, and manage document attachments
 */

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  XMarkIcon,
  ArrowUpTrayIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  DocumentIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import { attachmentsApi, type Attachment } from '../api/docs.api';

interface MediaBrowserProps {
  documentId: string;
  onClose: () => void;
  onSelect?: (attachment: Attachment) => void;
}

export function MediaBrowser({ documentId, onClose, onSelect }: MediaBrowserProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch attachments
  const { data: attachmentsResponse, isLoading } = useQuery({
    queryKey: ['docs-attachments', documentId],
    queryFn: () => attachmentsApi.list(documentId),
  });

  const attachments = attachmentsResponse?.data || [];

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploading(true);
      setUploadProgress(0);
      const response = await attachmentsApi.upload(documentId, file);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docs-attachments', documentId] });
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: () => {
      setUploading(false);
      setUploadProgress(0);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) => attachmentsApi.delete(attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docs-attachments', documentId] });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const handleDelete = (attachmentId: string) => {
    if (window.confirm('Are you sure you want to delete this attachment?')) {
      deleteMutation.mutate(attachmentId);
    }
  };

  const handleDownload = (attachment: Attachment) => {
    window.open(attachmentsApi.getDownloadUrl(attachment.id), '_blank');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const isImage = (mimetype: string): boolean => {
    return mimetype.startsWith('image/');
  };

  const getFileIcon = (mimetype: string) => {
    if (isImage(mimetype)) {
      return <PhotoIcon className="h-6 w-6" />;
    }
    return <DocumentIcon className="h-6 w-6" />;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Media & Attachments
          </h2>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <ArrowUpTrayIcon className="h-4 w-4" />
              Upload
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between text-sm text-blue-900 dark:text-blue-100 mb-2">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500 dark:text-gray-400">Loading attachments...</div>
            </div>
          ) : attachments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <PhotoIcon className="h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No attachments yet
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Upload images, PDFs, and other files to attach to this document
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Upload File
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  {/* Preview */}
                  <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                    {isImage(attachment.mimetype) ? (
                      <img
                        src={attachmentsApi.getDownloadUrl(attachment.id)}
                        alt={attachment.filename}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => onSelect?.(attachment)}
                      />
                    ) : (
                      <div className="text-gray-400 dark:text-gray-500">
                        {getFileIcon(attachment.mimetype)}
                      </div>
                    )}
                  </div>

                  {/* Filename */}
                  <div
                    className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate mb-1"
                    title={attachment.filename}
                  >
                    {attachment.filename}
                  </div>

                  {/* File size */}
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    {formatFileSize(attachment.size)}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {onSelect && isImage(attachment.mimetype) && (
                      <button
                        onClick={() => onSelect(attachment)}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                      >
                        Insert
                      </button>
                    )}
                    <button
                      onClick={() => handleDownload(attachment)}
                      className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                      title="Download"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(attachment.id)}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
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
      </div>
    </div>
  );
}
