/**
 * Media Preview Modal
 * Detailed view of a media file with metadata and actions
 */

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  XMarkIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  DocumentIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { AuthenticatedImage } from './AuthenticatedImage';
import { attachmentsApi, type Attachment } from '../api/docs.api';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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


  const isImage = attachment?.mimetype.startsWith('image/') ?? false;
  const isPdf = attachment?.mimetype === 'application/pdf';
  const downloadUrl = attachment ? attachmentsApi.getDownloadUrl(attachment.id) : '';

  const [pdfFile, setPdfFile] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);

  useEffect(() => {
    if (isPdf && isOpen) {
      const fetchPdf = async () => {
        try {
          // setLoadingPdf(true);
          const token = localStorage.getItem('accessToken');
          const response = await fetch(downloadUrl, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!response.ok) throw new Error('Failed to load PDF');

          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          setPdfFile(url);
          setPageNumber(1);
          setScale(0.8); // Start with smaller zoom to fit most screens
        } catch (error) {
          console.error('Error fetching PDF:', error);
        } finally {
          // setLoadingPdf(false);
        }
      };

      fetchPdf();
    }

    return () => {
      if (pdfFile) URL.revokeObjectURL(pdfFile);
    };
  }, [attachment?.id, isPdf, isOpen, downloadUrl]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  const changePage = (offset: number) => {
    setPageNumber(prevPageNumber => prevPageNumber + offset);
  };

  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);

  const handleDownload = () => {
    if (!attachment) return;
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
    if (!attachment) return;
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

  if (!attachment) return null;

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
              <Dialog.Panel className="w-full max-w-[95vw] h-[85vh] transform overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl transition-all flex flex-col">
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-6 py-4 bg-white dark:bg-gray-900 z-10">
                  <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate pr-4">
                    {attachment.filename}
                  </Dialog.Title>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={onClose}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex overflow-hidden">
                  {/* Left Side: Preview */}
                  <div className="flex-1 bg-gray-100 dark:bg-gray-800/50 relative flex flex-col min-w-0">

                    {/* PDF Toolbar */}
                    {isPdf && (
                      <div className="flex items-center justify-center gap-4 px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm z-10">
                        {/* Zoom Controls */}
                        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                          <button
                            onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
                            className="p-1.5 hover:bg-white dark:hover:bg-gray-600 rounded text-gray-600 dark:text-gray-300 disabled:opacity-50"
                            title="Zoom Out"
                          >
                            <MagnifyingGlassMinusIcon className="h-4 w-4" />
                          </button>
                          <span className="text-xs font-medium w-12 text-center text-gray-700 dark:text-gray-200">
                            {Math.round(scale * 100)}%
                          </span>
                          <button
                            onClick={() => setScale(s => Math.min(3.0, s + 0.1))}
                            className="p-1.5 hover:bg-white dark:hover:bg-gray-600 rounded text-gray-600 dark:text-gray-300 disabled:opacity-50"
                            title="Zoom In"
                          >
                            <MagnifyingGlassPlusIcon className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                          <button
                            disabled={pageNumber <= 1}
                            onClick={previousPage}
                            className="p-1.5 hover:bg-white dark:hover:bg-gray-600 rounded text-gray-600 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Previous Page"
                          >
                            <ChevronLeftIcon className="h-4 w-4" />
                          </button>
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-200 px-2 min-w-[80px] text-center">
                            Page {pageNumber || '--'} of {numPages || '--'}
                          </p>
                          <button
                            disabled={pageNumber >= numPages}
                            onClick={nextPage}
                            className="p-1.5 hover:bg-white dark:hover:bg-gray-600 rounded text-gray-600 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Next Page"
                          >
                            <ChevronRightIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Scrollable View Area */}
                    <div className="flex-1 overflow-auto bg-gray-50/50 dark:bg-gray-900/50 flex flex-col">
                      <div className="m-auto p-8">
                        {isImage ? (
                          <div className="max-w-full max-h-full overflow-hidden rounded-lg shadow-lg">
                            <AuthenticatedImage
                              src={downloadUrl}
                              alt={attachment.filename}
                              className="max-w-full max-h-[75vh] object-contain"
                            />
                          </div>
                        ) : isPdf ? (
                          <div className="shadow-2xl">
                            {pdfFile && (
                              <Document
                                file={pdfFile}
                                onLoadSuccess={onDocumentLoadSuccess}
                                loading={
                                  <div className="flex flex-col items-center p-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
                                    <span className="text-sm text-gray-500">Loading document...</span>
                                  </div>
                                }
                                error={
                                  <div className="flex flex-col items-center p-12 text-red-500">
                                    <DocumentIcon className="h-12 w-12 mb-2 opacity-50" />
                                    <span>Failed to load PDF</span>
                                  </div>
                                }
                                className="flex flex-col items-center"
                              >
                                <Page
                                  pageNumber={pageNumber}
                                  scale={scale}
                                  renderTextLayer={true}
                                  renderAnnotationLayer={true}
                                  className="bg-white shadow-lg"
                                  loading={
                                    <div className="w-[600px] h-[800px] bg-white animate-pulse flex items-center justify-center text-gray-300">
                                      Loading page...
                                    </div>
                                  }
                                />
                              </Document>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-gray-400">
                            <DocumentIcon className="h-24 w-24 mb-4" />
                            <p className="text-sm">Preview not available</p>
                            <p className="text-xs mt-1">{attachment.mimetype}</p>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Right Side: Details */}
                  <div className="w-80 flex-shrink-0 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-6 overflow-y-auto">
                    {/* File Information */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                        File Information
                      </h3>
                      <dl className="space-y-3">
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                          <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Type</dt>
                          <dd className="text-sm text-gray-900 dark:text-gray-100 truncate" title={attachment.mimetype}>
                            {attachment.mimetype}
                          </dd>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                          <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Size</dt>
                          <dd className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                            {formatFileSize(attachment.size)}
                          </dd>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                          <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Uploaded</dt>
                          <dd className="text-sm text-gray-900 dark:text-gray-100">
                            {formatDate(attachment.created_at || new Date().toISOString())}
                            {/* Fallback date if created_at is missing from type */}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                        Actions
                      </h3>
                      <button
                        onClick={handleDownload}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        Download File
                      </button>
                      {onDelete && (
                        <button
                          onClick={handleDelete}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 rounded-xl transition-colors"
                        >
                          <TrashIcon className="h-4 w-4" />
                          Delete File
                        </button>
                      )}
                    </div>

                    {/* URL for embedding */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                        Embed URL
                      </h3>
                      <div className="relative group">
                        <input
                          type="text"
                          readOnly
                          value={downloadUrl}
                          className="w-full px-3 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                          onClick={(e) => e.currentTarget.select()}
                        />
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity px-1">
                          <button
                            onClick={() => navigator.clipboard.writeText(downloadUrl)}
                            className="text-[10px] bg-gray-900/80 text-white px-2 py-1 rounded shadow"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                        Use this URL to reference the file in external systems or documents.
                      </p>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition >
  );
}
