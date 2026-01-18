/**
 * Documentation Manager API Client
 */

import { apiClient } from '../../../api/client';

// Types
export interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  order: number;
  document_count?: number;
  folder_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  name: string;
  description?: string;
  category_id: string;
  parent_id?: string;
  icon?: string;
  order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  document_count?: number;
  subfolder_count?: number;
  children?: Folder[];
  category?: {
    id: string;
    name: string;
    icon?: string;
  };
  subfolders?: Folder[];
  documents?: DocumentListItem[];
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
}

export interface DocumentAuthor {
  id: string;
  username: string;
  email?: string;
}

export interface DocumentListItem {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  category_id: string;
  folder_id?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  category: {
    id: string;
    name: string;
    icon?: string;
  };
  author: DocumentAuthor;
  tags: Tag[];
}

export interface Document extends DocumentListItem {
  content: string;
  content_html: string;
  category_id: string;
  folder_id?: string;
  author_id: string;
}

export interface DocumentVersion {
  id: string;
  version: number;
  title: string;
  content?: string;
  change_note?: string;
  created_at: string;
  author: DocumentAuthor;
}

export interface Attachment {
  id: string;
  document_id: string;
  filename: string;
  filepath: string;
  mimetype: string;
  size: number;
  uploaded_by: string;
  created_at: string;
}

export interface CreateCategoryData {
  name: string;
  description?: string;
  icon?: string;
  order?: number;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string;
  icon?: string;
  order?: number;
}

export interface CreateFolderData {
  name: string;
  description?: string;
  categoryId: string;
  parentId?: string;
  icon?: string;
  order?: number;
}

export interface UpdateFolderData {
  name?: string;
  description?: string;
  parentId?: string;
  icon?: string;
  order?: number;
}

export interface CreateDocumentData {
  title: string;
  content: string;
  categoryId: string;
  folderId?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  tags?: string[];
}

export interface UpdateDocumentData {
  title?: string;
  content?: string;
  categoryId?: string;
  folderId?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  tags?: string[];
  changeNote?: string;
}

export interface DocumentFilters {
  categoryId?: string;
  folderId?: string;
  status?: string;
  search?: string;
  tags?: string[];
  authorId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Categories API
 */
export const categoriesApi = {
  async list() {
    const response = await apiClient.get<Category[]>('/m/documentation-manager/categories');
    return response;
  },

  async get(id: string) {
    const response = await apiClient.get<Category>(`/m/documentation-manager/categories/${id}`);
    return response;
  },

  async create(data: CreateCategoryData) {
    const response = await apiClient.post<Category>('/m/documentation-manager/categories', data);
    return response;
  },

  async update(id: string, data: UpdateCategoryData) {
    const response = await apiClient.put<Category>(`/m/documentation-manager/categories/${id}`, data);
    return response;
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/m/documentation-manager/categories/${id}`);
    return response;
  },
};

/**
 * Folders API
 */
export const foldersApi = {
  async list(categoryId: string) {
    const response = await apiClient.get<Folder[]>(`/m/documentation-manager/folders?categoryId=${categoryId}`);
    return response;
  },

  async get(id: string) {
    const response = await apiClient.get<Folder>(`/m/documentation-manager/folders/${id}`);
    return response;
  },

  async create(data: CreateFolderData) {
    const response = await apiClient.post<Folder>('/m/documentation-manager/folders', data);
    return response;
  },

  async update(id: string, data: UpdateFolderData) {
    const response = await apiClient.put<Folder>(`/m/documentation-manager/folders/${id}`, data);
    return response;
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/m/documentation-manager/folders/${id}`);
    return response;
  },
};

/**
 * Documents API
 */
export const documentsApi = {
  async list(filters?: DocumentFilters) {
    const params = new URLSearchParams();
    if (filters?.categoryId) params.append('categoryId', filters.categoryId);
    if (filters?.folderId) params.append('folderId', filters.folderId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.authorId) params.append('authorId', filters.authorId);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    if (filters?.tags) {
      filters.tags.forEach(tag => params.append('tags', tag));
    }

    const queryString = params.toString();
    const url = queryString ? `/m/documentation-manager/documents?${queryString}` : '/m/documentation-manager/documents';
    const response = await apiClient.get<DocumentListItem[]>(url);
    return response;
  },

  async get(id: string) {
    const response = await apiClient.get<Document>(`/m/documentation-manager/documents/${id}`);
    return response;
  },

  async getBySlug(slug: string) {
    const response = await apiClient.get<Document>(`/m/documentation-manager/documents/slug/${slug}`);
    return response;
  },

  async create(data: CreateDocumentData) {
    const response = await apiClient.post<Document>('/m/documentation-manager/documents', data);
    return response;
  },

  async update(id: string, data: UpdateDocumentData) {
    const response = await apiClient.put<Document>(`/m/documentation-manager/documents/${id}`, data);
    return response;
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/m/documentation-manager/documents/${id}`);
    return response;
  },

  async getVersions(id: string) {
    const response = await apiClient.get<DocumentVersion[]>(`/m/documentation-manager/documents/${id}/versions`);
    return response;
  },

  async getVersion(id: string, version: number) {
    const response = await apiClient.get<DocumentVersion>(`/m/documentation-manager/documents/${id}/versions/${version}`);
    return response;
  },

  async restoreVersion(id: string, version: number) {
    const response = await apiClient.post<Document>(`/m/documentation-manager/documents/${id}/versions/${version}/restore`, {});
    return response;
  },
};

/**
 * Attachments API
 */
export const attachmentsApi = {
  // Global media library methods
  async listAll(search?: string, limit = 50, offset = 0) {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    const queryString = params.toString();
    const url = queryString ? `/m/documentation-manager/attachments?${queryString}` : '/m/documentation-manager/attachments';
    const response = await apiClient.get<Attachment[]>(url);
    return response;
  },

  async uploadStandalone(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
    const response = await fetch(`${API_BASE_URL}/m/documentation-manager/attachments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Upload failed');
    }

    return response.json();
  },

  // Document-specific attachment methods
  async list(documentId: string) {
    const response = await apiClient.get<Attachment[]>(`/m/documentation-manager/attachments/${documentId}`);
    return response;
  },

  async upload(documentId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
    const response = await fetch(`${API_BASE_URL}/m/documentation-manager/attachments/${documentId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Upload failed');
    }

    return response.json();
  },

  async delete(attachmentId: string) {
    const response = await apiClient.delete(`/m/documentation-manager/attachments/${attachmentId}`);
    return response;
  },

  getDownloadUrl(attachmentId: string) {
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
    return `${API_BASE_URL}/m/documentation-manager/attachments/download/${attachmentId}`;
  },
};
