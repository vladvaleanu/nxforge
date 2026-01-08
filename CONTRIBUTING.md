# Contributing to Automation Platform

## Development Setup

### Using GitHub Codespaces (Recommended)

1. Open the repository in GitHub
2. Click "Code" → "Codespaces" → "New codespace"
3. Wait for the environment to initialize
4. Run `npm install` and `npm run dev`

### Local Development

1. Ensure Node.js 20+ is installed
2. Clone the repository
3. Run `npm install`
4. Start development with `npm run dev`

## Monorepo Workflow

This project uses npm workspaces. Each package is independent:

```bash
# Work on backend
cd packages/backend
npm run dev

# Work on frontend
cd packages/frontend
npm run dev

# Run commands from root for all packages
npm run build        # Builds all packages
npm run test         # Tests all packages
npm run typecheck    # Type checks all packages
```

## Code Standards

### TypeScript

- All code must be written in TypeScript
- Strict mode is enabled
- No `any` types without justification
- All functions must have return types

### Linting

- ESLint is configured for all packages
- Run `npm run lint` before committing
- Fix issues with `npm run lint -- --fix`

### Formatting

- Prettier is used for code formatting
- 2 spaces for indentation
- Single quotes
- 100 character line width

## Testing

- Write tests for all new features
- Maintain minimum 80% code coverage
- Run tests with `npm run test`

## Commit Messages

Follow conventional commits:

```
feat: add user authentication
fix: resolve memory leak in worker pool
docs: update API documentation
chore: upgrade dependencies
test: add integration tests for scheduler
```

## Pull Request Process

1. Create a feature branch from `develop`
2. Make your changes
3. Ensure all tests pass
4. Update documentation if needed
5. Submit PR to `develop` branch
6. Wait for CI/CD to pass
7. Request review

## CI/CD Pipeline

All PRs must pass:
- ✅ Linting
- ✅ Type checking
- ✅ Tests
- ✅ Build

GitHub Actions will automatically run these checks.
