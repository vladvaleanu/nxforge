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
├── .github/
│   └── workflows/        # CI/CD pipelines
└── docs/                 # Documentation
```

## 🚀 Technology Stack

### Backend
- **Runtime**: Node.js 20+ LTS
- **Framework**: Fastify
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL 16 + TimescaleDB
- **Queue**: Redis + BullMQ
- **ORM**: Prisma

### Frontend
- **Framework**: React 18+
- **Build Tool**: Vite
- **State**: Zustand + React Query
- **Styling**: Tailwind CSS
- **Charts**: Recharts

### Automation
- **Browser**: Playwright
- **Containers**: Docker/Podman
- **Secrets**: HashiCorp Vault

## 📋 Prerequisites

- **Node.js**: >= 20.0.0
- **npm**: >= 10.0.0
- **PostgreSQL**: >= 16
- **Redis**: >= 7.0
- **Docker**: (optional) for containerized modules

## 🛠️ Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/vladvaleanu/automation-platform.git
cd automation-platform

# Install dependencies
npm install

# Build all packages
npm run build
```

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

### ✅ Phase 1: Foundation (Current)
- [x] Project scaffolding
- [x] Monorepo setup
- [x] TypeScript configuration
- [x] CI/CD pipeline
- [ ] Core API setup
- [ ] Database schema
- [ ] Authentication
- [ ] Frontend shell

### 🔄 Phase 2: Module System
- [ ] Module registry
- [ ] Lifecycle management
- [ ] Dynamic routing
- [ ] Frontend module loading

### 🔄 Phase 3: Automation Runtime
- [ ] Job scheduler
- [ ] Worker pool
- [ ] Browser automation
- [ ] Event bus

### 🔄 Phase 4: Consumption Monitor
- [ ] Endpoint management
- [ ] Scraping engine
- [ ] Time-series storage
- [ ] Real-time UI

### 🔄 Phase 5: Production Hardening
- [ ] Security hardening
- [ ] Observability
- [ ] High availability
- [ ] Documentation

## 📚 Documentation

- [Architecture Document](./DataCenter_Automation_Platform_Architecture.docx)
- [Module Development Guide](./docs/module-development.md) _(coming soon)_
- [API Reference](./docs/api-reference.md) _(coming soon)_
- [Deployment Guide](./docs/deployment.md) _(coming soon)_

## 🤝 Development Workflow

### Working with GitHub Actions

This project is configured to run entirely in GitHub Actions, allowing development without local Node.js installation:

1. **Make changes** to code files
2. **Commit and push** to GitHub
3. **CI/CD pipeline** automatically runs:
   - Linting
   - Type checking
   - Tests
   - Build

### Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - Feature branches

## 📄 License

MIT

## 👥 Authors

- Vlad Valeanu

---

**Version**: 1.0.0 | **Status**: Phase 1 - Foundation
