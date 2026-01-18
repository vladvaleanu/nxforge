# Documentation Manager - Development Phases

## Phase 1: MVP (✅ COMPLETED)
- ✅ Database schema with categories, folders, documents
- ✅ Basic CRUD operations for categories, folders, documents
- ✅ Document versioning support
- ✅ Tag system
- ✅ Permission system (category and document level)
- ✅ Basic frontend UI (DocumentBrowser, DocumentViewer, DocumentEditor)
- ✅ Markdown support
- ✅ Module registration and loading

## Phase 2: Enhanced Editing & Media (PENDING)
### Backend
- [ ] **WYSIWYG Editor Integration**
  - Integrate TipTap or similar rich text editor
  - Support for formatting, lists, tables
  - Image embedding support

- [ ] **Media Management**
  - File upload endpoint (`POST /documents/:id/attachments`)
  - Support for images, videos, PDFs
  - File storage (local or cloud)
  - Thumbnail generation for images
  - File size and type validation

- [ ] **Document Attachments**
  - Link files to documents
  - Download endpoint
  - Preview support for common formats

### Frontend
- [ ] **Rich Text Editor Component**
  - TipTap integration
  - Toolbar with formatting options
  - Image upload via drag-and-drop
  - Code block support with syntax highlighting

- [ ] **Media Browser**
  - Grid view of attached files
  - Upload interface
  - Preview modal
  - Delete functionality

- [ ] **Dual Editor Mode**
  - Toggle between Markdown and WYSIWYG
  - Real-time preview for Markdown
  - Preserve formatting when switching

## Phase 3: Templates & Workflow (PENDING)
### Backend
- [ ] **Document Templates**
  - Template schema (extends documents with `isTemplate` flag)
  - Create document from template endpoint
  - Template variables support
  - Default templates migration

- [ ] **Approval Workflow**
  - Workflow states (DRAFT → REVIEW → APPROVED → PUBLISHED)
  - Assignment of reviewers
  - Approval/rejection endpoints
  - Notification system integration
  - Workflow history tracking

- [ ] **Permissions Enhancement**
  - Role-based access (viewer, editor, reviewer, admin)
  - Workflow-aware permissions
  - Bulk permission updates

### Frontend
- [ ] **Template Selector**
  - Browse available templates
  - Preview template
  - Create from template dialog

- [ ] **Workflow UI**
  - Status badges and timeline
  - Submit for review button
  - Reviewer assignment interface
  - Approval/rejection interface
  - Workflow history view

- [ ] **Advanced Permissions UI**
  - Permission matrix view
  - Role assignment interface
  - Inheritance visualization

## Phase 4: PDF Export & Search (PENDING)
### Backend
- [ ] **PDF Export**
  - Convert Markdown/HTML to PDF
  - Use puppeteer or similar library
  - Support for custom styling
  - Include metadata (author, date, version)
  - Batch export for multiple documents

- [ ] **Full-Text Search**
  - PostgreSQL full-text search optimization
  - Search across title, content, tags
  - Search filters (category, status, author, date)
  - Search highlighting
  - Search history/suggestions

- [ ] **Advanced Queries**
  - Related documents
  - Recently updated
  - Most viewed
  - Analytics endpoints

### Frontend
- [ ] **Export Options**
  - Export as PDF button
  - Batch export selection
  - Download progress indicator

- [ ] **Advanced Search**
  - Search bar with filters
  - Search results page
  - Highlighted matches
  - Faceted search (by category, tags, status)
  - Search history

- [ ] **Analytics Dashboard**
  - Document view statistics
  - Most popular documents
  - Usage trends
  - User activity

## Technical Debt & Improvements
- [ ] **Testing**
  - Unit tests for services
  - Integration tests for API endpoints
  - E2E tests for critical workflows

- [ ] **Performance**
  - Implement caching for frequently accessed documents
  - Optimize database queries
  - Lazy loading for large documents
  - Pagination for lists

- [ ] **Security**
  - XSS prevention in rich text editor
  - File upload validation and sanitization
  - Rate limiting for upload endpoints
  - Audit logging for sensitive operations

- [ ] **Documentation**
  - API documentation (OpenAPI/Swagger)
  - User guide
  - Admin guide
  - Developer documentation

## Priority Order
1. **Phase 2** - Media management is critical for a documentation system
2. **Phase 4 (Search)** - Search becomes essential as content grows
3. **Phase 3 (Templates)** - Templates improve content creation
4. **Phase 3 (Workflow)** - Workflow is important for larger teams
5. **Phase 4 (PDF Export)** - Nice to have for sharing
6. **Technical Debt** - Ongoing throughout all phases

## Estimated Effort
- Phase 2: 2-3 days
- Phase 3: 3-4 days
- Phase 4: 2-3 days
- Technical Debt: Ongoing

## Next Steps
1. Fix current schema issue (order column) ✅
2. Complete Phase 2 (WYSIWYG + Media)
3. Implement search functionality
4. Add templates and workflow
