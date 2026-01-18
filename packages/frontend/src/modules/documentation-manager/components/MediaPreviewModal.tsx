/**
 * Media Preview Modal
 * Detailed view of a media file with metadata and actions
 */

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  XMarkIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline';
import { AuthenticatedImage } from './AuthenticatedImage';
import { attachmentsApi, type Attachment } from '../api/docs.api';

interface MediaPreviewModalProps {
  attachment: Attachment | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (attachmentId: string) => void;
}

export function MediaPreviewModal({
  attachment,
  isOpen,
  onClose,
  onDelete,
}: MediaPreviewModalProps) {
  if (!attachment) return null;

  const isImage = attachment.mimetype.startsWith('image/');
  const downloadUrl = attachmentsApi.getDownloadUrl(attachment.id);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = attachment.filename;

    // For authenticated downloads, we need to fetch with auth and trigger download
    const token = localStorage.getItem('accessToken');
    fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
      .then(response => response.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      })
      .catch(err => {
        console.error('Download failed:', err);
        alert('Failed to download file');
      });
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${attachment.filename}"?`)) {
      onDelete?.(attachment.id);
      onClose();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/75" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-6 py-4">
                  <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate pr-4">
                    {attachment.filename}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex flex-col lg:flex-row">
                  {/* Preview Section */}
                  <div className="flex-1 bg-gray-50 dark:bg-gray-800/50 p-8 flex items-center justify-center">
                    {isImage ? (
                      <div className="max-w-full max-h-[60vh] overflow-hidden rounded-lg">
                        <AuthenticatedImage
                          src={downloadUrl}
                          alt={attachment.filename}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <DocumentIcon className="h-24 w-24 mb-4" />
                        <p className="text-sm">Preview not available</p>
                        <p className="text-xs mt-1">{attachment.mimetype}</p>
                      </div>
                    )}
                  </div>

                  {/* Details Section */}
                  <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-800 p-6 space-y-6">
                    {/* File Information */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                        File Information
                      </h3>
                      <dl className="space-y-2">
                        <div>
                          <dt className="text-xs text-gray-500 dark:text-gray-400">Type</dt>
                          <dd className="text-sm text-gray-900 dark:text-gray-100 mt-0.5">
                            {attachment.mimetype}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-gray-500 dark:text-gray-400">Size</dt>
                          <dd className="text-sm text-gray-900 dark:text-gray-100 mt-0.5">
                            {formatFileSize(attachment.size)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-gray-500 dark:text-gray-400">Uploaded</dt>
                          <dd className="text-sm text-gray-900 dark:text-gray-100 mt-0.5">
                            {formatDate(attachment.createdAt)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-gray-500 dark:text-gray-400">ID</dt>
                          <dd className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono truncate">
                            {attachment.id}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    {/* Actions */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                        Actions
                      </h3>
                      <button
                        onClick={handleDownload}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        Download
                      </button>
                      {onDelete && (
                        <button
                          onClick={handleDelete}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                        >
                          <TrashIcon className="h-4 w-4" />
                          Delete
                        </button>
                      )}
                    </div>

                    {/* URL for embedding */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                        Embed URL
                      </h3>
                      <div className="relative">
                        <input
                          type="text"
                          readOnly
                          value={downloadUrl}
                          className="w-full px-3 py-2 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 font-mono"
                          onClick={(e) => e.currentTarget.select()}
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(downloadUrl);
                            // Could add a toast notification here
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
