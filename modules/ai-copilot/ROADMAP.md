# Forge Module: Roadmap & Functional Specification

> **Goal**: Build "Forge", the Local Intelligent Infrastructure Operator.

## 0. Dependencies & Prerequisites

| Dependency | Version | Purpose |
|------------|---------|--------|
| Ollama | 0.4+ | Local LLM inference (Llama 3.1, Mistral, etc.) |
| PostgreSQL | 15+ | Database with pgvector extension |
| pgvector | 0.7+ | Vector similarity search for RAG |
| Redis | 7+ | Event bus, job queue (existing infra) |

**Optional:**
- `nomic-embed-text` or `mxbai-embed-large` models for embeddings

## 1. User Interface (Frontend) Specification

### A. The Command Center (Main Page)
**Path**: `/modules/ai-copilot` or `/ai-copilot`
**Layout**: Split-Pane (Vertical Split). Resizable.

#### Top Pane: "Situation Deck" (Live Alerts)
-   **View Modes**:
    1.  **Summary View** (Default): Cards represent *Incidents* (Groups of alerts).
    2.  **Expanded View**: Clicking an Incident reveals rows of *Raw Alerts*.
-   **Incident Card Fields**:
    -   `Severity Badge`: Critical (Red Pulse) / Warning (Yellow) / Info (Blue).
    -   `Title`: Auto-generated summary (e.g., "Multiple PDU Failure").
    -   `Impact`: "Affects 12 Racks, 3 Zones".
    -   `Duration`: "Active for 4m 20s".
    -   `Badge`: "Forge Analysis Available" (Icon).
    -   `Actions`: [Expand] [Chat with Forge] [Dismiss].

#### Bottom Pane: "Forge Workspace" (Chat)
-   **Header**:
    -   `Status`: "Connected (Ollama: Llama 3.1)" or "Offline".
    -   `Context Focus`: "Viewing Incident #124".
-   **Chat Stream**:
    -   **System Messages**: "Reading logs...", "Consulting SOP-102...".
    -   **Forge Messages**: Markdown supported. Code blocks for commands.
    -   **Strict Warnings**: Red border messages for SOP violations.
-   **Input Area**:
    -   `Text Field`: Supports free text and **Slash Commands** (e.g., `/clear`, `/status`, `/promote`).
    -   `Command Palette`: Auto-complete popup when `/` is typed.
    -   `Actions`: [Promote to Team] [Clear Context].

### B. Admin Dashboard (Knowledge & Approval)
**Path**: `/modules/ai-copilot/admin`
**Permission**: `ai_copilot:admin`

#### Tab 1: Knowledge Queue (Approvals)
-   **Review Queue**: Pending items waiting for approval.
-   **Conversation Audit Log**:
    *   *Admin Only View*: Searchable history of all user-Forge interactions.
    *   Filters: By User, date, or topic.
    *   Purpose: Compliance & oversight.

#### Tab 2: Settings (Configuration)
-   **Section 1: AI Brain (Generation)**
    -   *Safe to change anytime. Controls who "speaks".*
    -   `Provider Engine`: Dropdown [Ollama, LocalAI, OpenAI-Compatible].
    -   `API Endpoint`: Input (e.g., `http://localhost:11434/v1`).
    -   `Chat Model`: Input/Dropdown (e.g., `llama3.1`, `mistral-nemo`).
    -   `Context Window`: Number (Adjustable).
-   **Section 2: Long-Term Memory (Embeddings)**
    -   *Requires re-indexing if changed. Stored via pgvector.*
    -   `Embedding Provider`: Dropdown (Default: `Same as Generation` or `nomic-embed-text`).
    -   `Embedding Model`: Input (e.g., `nomic-embed-text`, `mxbai-embed-large`).
    -   `Vector Dimensions`: Auto-detected from model (e.g., 768 for nomic).
-   **Section 3: Personality & Strictness**
    -   `Persona Name`: Input (default: "Forge").
    -   `Strictness Level`: Slider (1=Helpful, 10=Military Strict).
    -   `Infrastructure Priority`: Checkboxes [X] Power [X] Cooling [ ] Access.
-   **Section 3: Alert Batching**
    -   `Batch Window`: Seconds (default: `30s`).
    -   `Min Alerts for Incident`: Number (default: `5`).

---

## 2. Backend Data Specification

### A. Database Schema (Prisma)

#### `AiConfig`
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | |
| `provider` | String | 'ollama' |
| `baseUrl` | String | 'http://localhost:11434' |
| `model` | String | 'llama3.1' |
| `strictness` | Int | 1-10 (Default: 5 - Balanced Advisor) |
| `batchWindow` | Int | Seconds to wait before analyzing |

### B. Core Registry (Data Access)
Instead of importing implementation details, we use a **Tool Registry**.
Other modules (Power, Cooling) register "Read Tools" that Forge can call.
-   `copilot.registerTool('pdu:read', (pduId) => ...)`
-   *Efficiency*: Direct function calls, no HTTP overhead. Type-safe.

#### `TriggerRule` (The Filter)
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | |
| `source` | String | 'consumption-monitor', 'access-control' |
| `condition` | String | JSON Logic or simple string match |
| `priority` | Enum | CRITICAL (Interrupt), STANDARD (Batch), LOG (Ignore) |
| `action` | Enum | PROMOTE_TO_DECK |

#### `KnowledgeItem` (The Brain)
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | |
| `content` | Text | The "Lesson" or SOP snippet |
| `tags` | Json | `['pdu', 'rack-4']` |
| `status` | Enum | PENDING, APPROVED, REJECTED |
| `embedding` | Float[] | Vector embedding (requires **pgvector** extension) |

> **Note**: Embeddings require PostgreSQL with the `pgvector` extension enabled.
> Run: `CREATE EXTENSION IF NOT EXISTS vector;`

---

## 3. Phased Implementation Roadmap

### ✅ Phase 1: Visual Core (COMPLETED)

**Completed: 2026-01-18**

#### Frontend Components Created:
| Component | Location | Purpose |
|-----------|----------|---------|
| `ChatPage.tsx` | `/modules/ai-copilot/pages/` | Full-screen chat view with quick actions |
| `SettingsPage.tsx` | `/modules/ai-copilot/pages/` | Configuration form (localStorage) |
| `KnowledgePage.tsx` | `/modules/ai-copilot/pages/` | RAG document management admin UI |
| `ForgeGlobalChat.tsx` | `/components/forge/` | Persistent floating chat widget (auto-hides when module disabled) |
| `ChatWidget.tsx` | `/modules/ai-copilot/components/` | Chat interface component with streaming |
| `SituationDeck.tsx` | `/modules/ai-copilot/components/` | Incident display (currently mock data) |

#### Core Platform Features (Moved from Module):
| Component | Location | Purpose |
|-----------|----------|---------|
| `IncidentsPage.tsx` | `/pages/monitoring/` | Core Incidents dashboard (Situation Deck) |
| `IncidentCard.tsx` | `/components/monitoring/` | Incident card with severity badges |
| `monitoring.types.ts` | `/types/` | Core incident/alert type definitions |

#### Architectural Decisions:
1. **Situation Deck → Core Platform**: Incident monitoring is now a core feature at `/incidents`, not part of the Forge module. This follows separation of concerns (monitoring ≠ AI).
2. **Forge = AI Layer Only**: The ai-copilot module now contains only chat and settings.
3. **Global Chat Widget**: Persistent pop-out available on all pages except Forge pages.
4. **Page Context Awareness**: Chat widget knows which page user is viewing.

#### Routes:
| Path | Component |
|------|-----------|
| `/incidents` | Core Incidents page (Situation Deck) |
| `/modules/ai-copilot` | Redirects to /chat |
| `/modules/ai-copilot/chat` | Full Forge chat page |
| `/modules/ai-copilot/knowledge` | RAG document management |
| `/modules/ai-copilot/settings` | Settings configuration |

#### Sidebar Structure:
```
Dashboard
Incidents          ← Direct top-level link (Core)
Automation
├── Modules, Jobs, Executions, Events
Power              ← Consumption monitoring  
├── Live Dashboard, Endpoints, Reports, History
Tools
├── Forge, Knowledge Base
Settings
```

> **✅ Done:**
> - Split between Core (Incidents) and Module (Forge Chat) ✓
> - Settings form saves to localStorage (mock persistence) ✓
> - Incident cards display mock data with severity badges ✓
> - Global floating chat widget with page awareness ✓
> - Chat persists across page navigations (localStorage) ✓

---

### ✅ Phase 2: Backend Plumbing (COMPLETED)

**Completed: 2026-01-18**

#### Backend Components Created:
| Component | Location | Purpose |
|-----------|----------|---------|
| `types/index.ts` | `modules/ai-copilot/src/` | ModuleContext, AiConfig, ChatMessage types |
| `ollama.service.ts` | `modules/ai-copilot/src/services/` | Ollama API wrapper with retry logic, streaming |
| `embedding.service.ts` | `modules/ai-copilot/src/services/` | Vector embeddings via nomic-embed-text (768-dim) |
| `knowledge.service.ts` | `modules/ai-copilot/src/services/` | RAG retrieval with pgvector similarity search |
| `routes/index.ts` | `modules/ai-copilot/src/` | API endpoints (/health, /models, /settings, /chat, /knowledge) |
| `001_create_ai_config.sql` | `modules/ai-copilot/src/migrations/` | Database schema for ai_config table |

#### Frontend Updates:
| Component | Location | Purpose |
|-----------|----------|---------|
| `api.ts` | `packages/frontend/src/modules/ai-copilot/` | API client with streaming support |
| `useForgeSettings.ts` | `packages/frontend/src/modules/ai-copilot/hooks/` | Backend + localStorage sync |
| `ChatWidget.tsx` | `packages/frontend/src/modules/ai-copilot/components/` | Connected to real Ollama |

#### Verified Endpoints:
- `GET /health` → Returns Ollama connection status and available models
- `GET /models` → Lists available Ollama models with details
- `GET/PUT /settings` → Persists config to PostgreSQL
- `POST /chat` → Real AI responses with RAG context (streaming supported)
- `GET /knowledge` → List AI-accessible documents
- `GET /knowledge/stats` → AI document statistics (total, embedded, pending)
- `POST /knowledge/search` → RAG similarity search

> **✅ Done:**
> - Settings save to `AiConfig` table and persist across restarts ✓
> - Chat input sends message to Ollama and receives response ✓
> - Streaming chat responses working ✓
> - API integration verified in browser ✓

---

### ✅ Phase 3: The Brain (COMPLETED)

#### ✅ RAG Knowledge Base (COMPLETED)
- **Embedding Service**: Vector embeddings via Ollama `nomic-embed-text` model (768 dimensions)
- **Knowledge Service**: pgvector similarity search with configurable threshold
- **Admin UI**: `/modules/ai-copilot/knowledge` for managing AI-accessible documents
- **Chat Integration**: Automatic RAG context retrieval on every chat request

> **✅ RAG Done:**
> - `embedding.service.ts` - batch embedding generation ✓
> - `knowledge.service.ts` - similarity search, stats, context formatting ✓
> - `KnowledgePage.tsx` - admin UI with search testing ✓
> - Chat uses RAG context for answers ✓
> - Documents have `ai_accessible` flag in documentation-manager module ✓

#### ✅ Alert Batching & Incidents (COMPLETED)
1.  **AlertBatcherService**: Groups alerts into incidents
    -   Logic: Batch by source + labels within 30s window
    -   Subscribes to `alert.created` events from other modules
    -   Configurable batch window and threshold

2.  **Incident Persistence**:
    -   Database schema: `ai_incidents`, `ai_alerts` tables
    -   API endpoints: `GET /incidents`, `GET /incidents/:id`, `PATCH /incidents/:id`
    -   Frontend polls every 5 seconds via TanStack Query

3.  **Wire Situation Deck**:
    -   `IncidentsPage.tsx` connected to real incident API
    -   Dismiss/resolve actions work with backend

4.  **Module Integration**:
    -   `POST /alerts/ingest` endpoint for external alert ingestion
    -   Event bus subscription for `alert.created` events

---

### ✅ Phase 4: Polish (COMPLETED)
1.  **Strict Mode**: System prompt uses strictness slider (1-10) from settings ✓
2.  **Error Handling**: "Reconnecting to Ollama..." banner with auto-retry ✓
3.  **Global Chat Integration**: `ForgeGlobalChat.tsx` uses real Ollama API with streaming ✓

> **✅ Done:**
> - Strictness slider (1-10) visibly changes Forge's tone in responses ✓
> - Ollama disconnect shows "Reconnecting..." banner, auto-recovers ✓
> - Global floating chat uses real Ollama with streaming responses ✓
> - Full user flow works: Alert → Incident → Chat → Knowledge ✓

---

## 4. Current Implementation Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Chat with Ollama | ✅ Complete | Streaming supported |
| Settings persistence | ✅ Complete | Backend + localStorage |
| RAG knowledge base | ✅ Complete | pgvector similarity search |
| Knowledge admin UI | ✅ Complete | Toggle AI access, search testing |
| Global floating chat | ✅ Complete | Real Ollama with streaming |
| Alert batching | ✅ Complete | 30s batch window |
| Incident persistence | ✅ Complete | ai_incidents, ai_alerts tables |
| Real incident data | ✅ Complete | Frontend connected |
| Strictness system prompt | ✅ Complete | Slider 1-10 changes tone |

