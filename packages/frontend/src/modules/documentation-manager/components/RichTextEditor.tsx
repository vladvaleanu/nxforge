/**
 * Rich Text Editor Component
 * TipTap-based WYSIWYG editor for document editing
 */

import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import {
  BoldIcon,
  ItalicIcon,
  ListBulletIcon,
  CodeBracketIcon,
  LinkIcon,
  PhotoIcon,
  Bars3BottomLeftIcon,
} from '@heroicons/react/24/outline';
import { MediaGallery } from './MediaGallery';
import { attachmentsApi } from '../api/docs.api';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
  documentId?: string;
}

// Create lowlight instance with common languages
const lowlight = createLowlight(common);

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start writing...',
  editable = true,
  documentId,
}: RichTextEditorProps) {
  const [showMediaBrowser, setShowMediaBrowser] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // We'll use CodeBlockLowlight instead
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 dark:text-blue-400 hover:underline cursor-pointer',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
    ],
    content: content || '',
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-gray dark:prose-invert max-w-none focus:outline-none min-h-[400px] p-4',
      },
    },
  });

  // Update editor content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '');
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const addImage = () => {
    // Open global media gallery
    setShowMediaBrowser(true);
  };

  const handleSelectImage = (attachment: any) => {
    const imageUrl = attachmentsApi.getDownloadUrl(attachment.id);
    editor.chain().focus().setImage({ src: imageUrl }).run();
    setShowMediaBrowser(false);
  };

  const setLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div className="border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
      {/* Toolbar */}
      {editable && (
        <div className="flex flex-wrap items-center gap-1 border-b border-gray-300 dark:border-gray-700 p-2">
          {/* Text Formatting */}
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
              editor.isActive('bold') ? 'bg-gray-200 dark:bg-gray-600' : ''
            }`}
            title="Bold"
          >
            <BoldIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
              editor.isActive('italic') ? 'bg-gray-200 dark:bg-gray-600' : ''
            }`}
            title="Italic"
          >
            <ItalicIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
              editor.isActive('code') ? 'bg-gray-200 dark:bg-gray-600' : ''
            }`}
            title="Inline Code"
          >
            <CodeBracketIcon className="h-4 w-4" />
          </button>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1" />

          {/* Headings */}
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 font-bold text-sm ${
              editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 dark:bg-gray-600' : ''
            }`}
            title="Heading 1"
          >
            H1
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 font-bold text-sm ${
              editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 dark:bg-gray-600' : ''
            }`}
            title="Heading 2"
          >
            H2
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 font-bold text-sm ${
              editor.isActive('heading', { level: 3 }) ? 'bg-gray-200 dark:bg-gray-600' : ''
            }`}
            title="Heading 3"
          >
            H3
          </button>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1" />

          {/* Lists */}
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
              editor.isActive('bulletList') ? 'bg-gray-200 dark:bg-gray-600' : ''
            }`}
            title="Bullet List"
          >
            <ListBulletIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
              editor.isActive('orderedList') ? 'bg-gray-200 dark:bg-gray-600' : ''
            }`}
            title="Numbered List"
          >
            <Bars3BottomLeftIcon className="h-4 w-4" />
          </button>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1" />

          {/* Code Block */}
          <button
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm ${
              editor.isActive('codeBlock') ? 'bg-gray-200 dark:bg-gray-600' : ''
            }`}
            title="Code Block"
          >
            {'</>'}
          </button>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1" />

          {/* Link */}
          <button
            onClick={setLink}
            className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
              editor.isActive('link') ? 'bg-gray-200 dark:bg-gray-600' : ''
            }`}
            title="Add Link"
          >
            <LinkIcon className="h-4 w-4" />
          </button>

          {/* Image */}
          <button
            onClick={addImage}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Add Image"
          >
            <PhotoIcon className="h-4 w-4" />
          </button>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1" />

          {/* Quote */}
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm ${
              editor.isActive('blockquote') ? 'bg-gray-200 dark:bg-gray-600' : ''
            }`}
            title="Quote"
          >
            "
          </button>

          {/* Horizontal Rule */}
          <button
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
            title="Horizontal Rule"
          >
            ―
          </button>
        </div>
      )}

      {/* Editor Content */}
      <EditorContent editor={editor} />

      {/* Media Gallery Modal */}
      {showMediaBrowser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-5xl h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Select Image
              </h2>
              <button
                onClick={() => setShowMediaBrowser(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <MediaGallery
                onSelectMedia={handleSelectImage}
                selectionMode={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
