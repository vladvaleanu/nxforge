# Data Center Automation Platform

> Modular Data Center Automation Platform - Web Control Plane + Automation Engine

A backend-first automation platform for data center monitoring and operations with hot-pluggable modularity. Modules can be installed, enabled, disabled, and removed at runtime without system restarts.

## 🏗️ Architecture

This platform implements a **three-layer architecture**:

1. **Web Control Plane** - React SPA for operator interaction
2. **Core Platform Services** - API gateway, module lifecycle, auth, scheduler, event bus
3. **Execution Layer** - Isolated automation runtime with headless browsers

## 📦 Monorepo Structure

```
automation-platform/
├── packages/
│   ├── backend/          # Core Platform Services & API
│   ├── frontend/         # Web Control Plane SPA
│   ├── shared/           # Shared types, utilities, schemas
│   └── cli/              # CLI tools for platform management
├── modules/              # Pluggable automation modules
│   └── example-module/   # Example module with handlers
├── .github/
│   └── workflows/        # CI/CD pipelines
└── docs/                 # Documentation
```

## 🚀 Technology Stack

### Backend
- **Runtime**: Node.js 20+ LTS
- **Framework**: Fastify
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL 16
- **Queue**: Redis + BullMQ (Phase 3)
- **ORM**: Prisma

### Frontend
- **Framework**: React 18+
- **Build Tool**: Vite
- **State**: React Query
- **Styling**: Tailwind CSS + Dark Mode
- **Routing**: React Router

### Automation
- **Browser**: Playwright (Phase 4)
- **Containers**: Docker/Podman (Phase 4)
- **Secrets**: HashiCorp Vault (Phase 5)

## 📋 Prerequisites

- **Node.js**: >= 20.0.0
- **npm**: >= 10.0.0
- **PostgreSQL**: >= 16
- **Redis**: >= 7.0 (for Phase 3)
- **Docker**: (optional) for development services

## 🛠️ Getting Started

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/vladvaleanu/automation-platform.git
cd automation-platform

# 2. Start database services (Docker)
docker-compose up -d

# 3. Install dependencies
npm install

# 4. Set up backend database
cd packages/backend
cp .env.example .env
npm run db:setup

# 5. Start backend
npm run dev

# 6. In another terminal, start frontend
cd packages/frontend
npm run dev
```

**Default Credentials**:
- Email: `admin@automation-platform.local`
- Password: `admin123`

See [Database Quick Start Guide](./docs/database-quickstart.md) for detailed setup.

### Development

```bash
# Run all packages in development mode
npm run dev

# Run specific package
npm run dev -w @automation-platform/backend
npm run dev -w @automation-platform/frontend

# Type checking
npm run typecheck

# Linting
npm run lint

# Testing
npm run test
```

## 🏗️ Implementation Roadmap

### ✅ Phase 1: Foundation (COMPLETE)
- [x] Project scaffolding & monorepo setup
- [x] TypeScript configuration
- [x] CI/CD pipeline with GitHub Actions
- [x] Core API with Fastify
- [x] Database schema with Prisma
- [x] JWT Authentication & RBAC
- [x] Frontend shell with React + Tailwind

**Status**: ✅ Complete | [Documentation](./PHASE1_COMPLETE.md)

### ✅ Phase 2: Module System (COMPLETE)
- [x] Module registry with manifest validation
- [x] Lifecycle management (install, enable, disable, remove)
- [x] Dynamic routing with TypeScript handler execution
- [x] Frontend module loading with lazy loading
- [x] Error boundaries for module isolation
- [x] Module management UI with dark mode

**Status**: ✅ Complete | [Documentation](./PHASE2_COMPLETE.md) | [Review](./PHASE2_REVIEW.md)

**Test Results**: 11/11 automated tests passing | [Test Suite](./test-phase2.sh)

### ✅ Phase 3: Job Scheduling & Automation Runtime (COMPLETE)
- [x] Job scheduler with BullMQ & Cron expressions
- [x] Worker pool with concurrent execution
- [x] Event bus for cross-module communication with Redis pub/sub
- [x] Shared services library (Browser, HTTP, Notifications, Logger, Database)
- [x] Job execution monitoring & logs
- [x] Jobs management UI with real-time updates
- [x] Events dashboard with statistics
- [x] Integration & unit tests
- [x] Comprehensive documentation
- [x] Example module with scheduled jobs

**Status**: ✅ Complete | [Documentation](./docs/phase3-job-scheduling.md) | [Example Module](./examples/modules/data-sync-module/)

### 🔄 Phase 4: Consumption Monitor
- [ ] Endpoint management for data center metrics
- [ ] Time-series storage with TimescaleDB
- [ ] Real-time dashboards for consumption monitoring
- [ ] Alert system based on thresholds

### 🔄 Phase 5: Production Hardening
- [ ] Security audit & hardening
- [ ] Observability & monitoring
- [ ] High availability setup
- [ ] Comprehensive documentation

## 📊 Current Status

**Version**: 3.0.0
**Phase**: Completed Phase 3, Ready for Phase 4
**Last Updated**: 2026-01-09

### Implemented Features

✅ **Authentication & Authorization**
- JWT access & refresh tokens
- Role-based access control (RBAC)
- User management
- Session tracking

✅ **Module System**
- Hot-pluggable modules
- Dynamic route registration
- TypeScript handler execution
- Manifest validation (JSON Schema)
- Module lifecycle management
- Frontend module loading
- Error isolation with boundaries

✅ **Job Scheduling & Automation**
- Cron-based job scheduling
- Manual job execution
- Worker pool with concurrent processing
- Job retry logic with timeout enforcement
- Execution history and logs
- Real-time status updates

✅ **Event System**
- Redis pub/sub event bus
- Pattern-based subscriptions
- Event history and statistics
- Cross-module communication

✅ **User Interface**
- Dashboard with status cards
- Module management page
- Job management with cron builder
- Execution monitoring and logs
- Events dashboard with analytics
- Dark/light theme toggle
- Responsive design
- Protected routes

### API Endpoints

**Authentication**: 5 endpoints
- Login, Register, Refresh, Logout, Me

**Modules**: 9 endpoints + wildcard routing
- List, Get, Create, Update, Delete, Enable, Disable, Validate
- Dynamic routes: `/api/v1/modules/:moduleName/*`

**Jobs**: 8 endpoints
- List, Get, Create, Update, Delete, Enable, Disable, Execute

**Executions**: 3 endpoints
- List, Get Details, Cancel

**Events**: 7 endpoints
- Emit, List, Get, Recent, Statistics, Subscriptions, Cleanup

## 📚 Documentation

### Getting Started
- [Database Quick Start](./docs/database-quickstart.md)
- [Database Documentation](./docs/database.md)
- [Backend Setup Guide](./packages/backend/README.md)
- [Frontend Setup Guide](./packages/frontend/README.md)

### Phase Documentation
- [Phase 1: Foundation Complete](./PHASE1_COMPLETE.md)
- [Phase 2: Module System Complete](./PHASE2_COMPLETE.md)
- [Phase 2: Implementation Review](./PHASE2_REVIEW.md)
- [Phase 3: Job Scheduling Complete](./docs/phase3-job-scheduling.md)

### Examples
- [Data Sync Module](./examples/modules/data-sync-module/) - Complete example with 3 scheduled jobs

### Architecture
- [Architecture Document](./DataCenter_Automation_Platform_Architecture.docx)
- [Module Registry Setup](./PHASE2_MODULE_REGISTRY_SETUP.md)

## 🧪 Testing

### Backend Tests
```bash
# Run Phase 2 module system tests (11 tests)
bash test-phase2.sh

# Run Phase 3 job scheduling tests
npm test -- job-execution.test.ts
npm test -- event-bus.test.ts
npm test -- events-api.test.ts

# Run all tests with coverage
npm test -- --coverage
```

### Test Coverage
- **Phase 2**: 11/11 automated tests passing ✅
- **Phase 3**: Full coverage for job execution, event bus, and API endpoints
- **Frontend**: Manual testing verified for all pages

## 🔐 Security Features

- **Authentication**: bcrypt password hashing, JWT tokens
- **Authorization**: RBAC with permission system
- **Input Validation**: JSON Schema validation
- **Error Isolation**: Module errors don't crash the app
- **Secure Headers**: CORS, CSP ready
- **Audit Logging**: Ready for implementation

## 🎯 Key Features

### For Operators
- ✅ Web-based control panel
- ✅ Module management (enable/disable)
- ✅ Job scheduling with cron expressions
- ✅ Execution monitoring with real-time logs
- ✅ Event history and analytics
- ✅ Dark mode support
- 🚧 Data center monitoring dashboards (Phase 4)

### For Developers
- ✅ TypeScript end-to-end
- ✅ Hot-pluggable module architecture
- ✅ Dynamic route registration
- ✅ Manifest-based configuration
- ✅ Event system with pub/sub
- ✅ Job handlers with shared services
- ✅ Comprehensive testing utilities

## 📈 Performance

- **Route Resolution**: O(1) lookup via Map
- **Module Loading**: Lazy loading with React.lazy
- **API Caching**: React Query with optimistic updates
- **Database**: Connection pooling with Prisma
- **Job Queue**: BullMQ with Redis for high throughput
- **Worker Pool**: Configurable concurrency for job execution
- **Event Bus**: Redis pub/sub for scalable event distribution

## 🤝 Development Workflow

### Working with GitHub Actions

This project uses CI/CD for automated testing:

1. **Make changes** to code files
2. **Commit and push** to GitHub
3. **CI/CD pipeline** automatically runs:
   - Linting
   - Type checking
   - Tests
   - Build verification

### Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - Feature branches

## 🐳 Docker Setup

```bash
# Start PostgreSQL (required)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Reset database (caution!)
docker-compose down -v
```

## 📄 License

MIT

## 👥 Authors

- Vlad Valeanu

## 🙏 Acknowledgments

Built with:
- **Fastify** - Fast and low overhead web framework
- **React** - UI library
- **Prisma** - Next-generation ORM
- **PostgreSQL** - Advanced open source database
- **Redis** - In-memory data store for queues and pub/sub
- **BullMQ** - Premium job queue for Node.js
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - JavaScript with types
- **Vite** - Next generation frontend tooling
- **React Query** - Data fetching and state management

---

**Current Phase**: ✅ Phase 3 Complete | 🚀 Phase 4 Ready

**Repository**: https://github.com/vladvaleanu/automation-platform

**Next Milestone**: Data Center Consumption Monitor
