# Database Architecture

Complete database documentation for the Automation Platform.

## Overview

The platform uses **PostgreSQL 16** as the primary database with **Prisma** as the ORM. The database is designed to support:

- User authentication and authorization (RBAC)
- Module lifecycle management
- Background job scheduling
- Audit logging and compliance
- Session management

## Database Schema

### Core Tables

#### users
Stores user account information.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | VARCHAR | Unique email address |
| username | VARCHAR | Unique username |
| password | VARCHAR | Bcrypt hashed password |
| firstName | VARCHAR | User's first name (optional) |
| lastName | VARCHAR | User's last name (optional) |
| isActive | BOOLEAN | Account active status |
| createdAt | TIMESTAMP | Account creation time |
| updatedAt | TIMESTAMP | Last update time |
| lastLogin | TIMESTAMP | Last successful login (nullable) |

**Indexes:**
- Unique index on `email`
- Unique index on `username`

---

#### roles
Defines system roles with associated permissions.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR | Role name (admin, operator, viewer) |
| description | TEXT | Role description |
| permissions | JSONB | Array of permission strings |
| createdAt | TIMESTAMP | Role creation time |
| updatedAt | TIMESTAMP | Last update time |

**Indexes:**
- Unique index on `name`

**Default Roles:**
```json
{
  "admin": {
    "permissions": ["*:*"]
  },
  "operator": {
    "permissions": [
      "modules:read", "modules:write", "modules:execute",
      "jobs:read", "jobs:write", "users:read"
    ]
  },
  "viewer": {
    "permissions": [
      "modules:read", "jobs:read", "users:read"
    ]
  }
}
```

---

#### user_roles
Many-to-many relationship between users and roles.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | Foreign key to users |
| roleId | UUID | Foreign key to roles |
| assignedAt | TIMESTAMP | Assignment time |
| assignedBy | UUID | User ID who assigned (nullable) |

**Indexes:**
- Unique composite index on `(userId, roleId)`

**Foreign Keys:**
- `userId` → `users.id` (CASCADE delete)
- `roleId` → `roles.id` (CASCADE delete)

---

#### sessions
Manages refresh token sessions for authentication.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | Foreign key to users |
| refreshToken | VARCHAR | JWT refresh token |
| userAgent | TEXT | Browser/client user agent |
| ipAddress | VARCHAR | Client IP address |
| expiresAt | TIMESTAMP | Token expiration time |
| createdAt | TIMESTAMP | Session creation time |
| revokedAt | TIMESTAMP | Revocation time (nullable) |

**Indexes:**
- Unique index on `refreshToken`

**Foreign Keys:**
- `userId` → `users.id` (CASCADE delete)

---

#### modules
Registry of installed automation modules.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR | Module identifier (kebab-case) |
| version | VARCHAR | Semantic version |
| displayName | VARCHAR | Human-readable name |
| description | TEXT | Module description |
| status | ENUM | Lifecycle status |
| manifest | JSONB | Module manifest (routes, jobs, etc.) |
| installedAt | TIMESTAMP | Installation time (nullable) |
| enabledAt | TIMESTAMP | Enable time (nullable) |
| disabledAt | TIMESTAMP | Disable time (nullable) |
| updatedAt | TIMESTAMP | Last update time |
| createdAt | TIMESTAMP | Registration time |

**Indexes:**
- Unique index on `name`

**Module Status Enum:**
- `REGISTERED` - Uploaded, not yet active
- `INSTALLING` - Installation in progress
- `ENABLED` - Fully operational
- `DISABLED` - Suspended
- `UPDATING` - New version installing
- `REMOVING` - Cleanup in progress

---

#### jobs
Background job queue metadata.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR | Job name/type |
| moduleName | VARCHAR | Source module (nullable) |
| status | ENUM | Job status |
| priority | INTEGER | Job priority (default: 0) |
| payload | JSONB | Job input data |
| result | JSONB | Job output (nullable) |
| error | JSONB | Error details (nullable) |
| attempts | INTEGER | Retry attempts (default: 0) |
| maxAttempts | INTEGER | Max retry limit (default: 3) |
| scheduledAt | TIMESTAMP | Scheduled execution time |
| startedAt | TIMESTAMP | Actual start time (nullable) |
| completedAt | TIMESTAMP | Completion time (nullable) |
| failedAt | TIMESTAMP | Failure time (nullable) |
| createdAt | TIMESTAMP | Job creation time |
| updatedAt | TIMESTAMP | Last update time |

**Indexes:**
- Index on `status`
- Index on `moduleName`
- Index on `scheduledAt`

**Job Status Enum:**
- `PENDING` - Waiting for execution
- `RUNNING` - Currently executing
- `COMPLETED` - Finished successfully
- `FAILED` - Failed after retries
- `CANCELLED` - Manually cancelled

---

#### audit_logs
Audit trail for security and compliance.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | User who performed action (nullable) |
| action | VARCHAR | Action performed |
| resource | VARCHAR | Resource affected |
| outcome | VARCHAR | success or failure |
| details | JSONB | Additional context |
| ipAddress | VARCHAR | Client IP |
| userAgent | TEXT | Client user agent |
| createdAt | TIMESTAMP | Event timestamp |

**Indexes:**
- Index on `userId`
- Index on `action`
- Index on `createdAt`

**Foreign Keys:**
- `userId` → `users.id` (SET NULL on delete)

---

## Entity Relationships

```
users
  ├─ 1:N → user_roles
  ├─ 1:N → sessions
  └─ 1:N → audit_logs

roles
  └─ 1:N → user_roles

modules
  └─ 1:N → jobs (via moduleName)

jobs
  └─ N:1 → modules (via moduleName, soft reference)
```

## Migrations

### Migration Strategy

- **Development**: `prisma db push` for rapid iteration
- **Production**: `prisma migrate deploy` for versioned migrations

### Creating Migrations

```bash
# Generate migration from schema changes
npx prisma migrate dev --name describe_changes

# Apply migrations to production
npx prisma migrate deploy
```

### Migration Files

Migrations are stored in `packages/backend/prisma/migrations/` with timestamp-based naming:

```
migrations/
├── 20260108000000_initial_schema/
│   └── migration.sql
└── migration_lock.toml
```

## Database Setup

### Using Docker Compose (Recommended for Development)

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Check services are running
docker-compose ps

# View logs
docker-compose logs -f postgres
```

**Connection String:**
```
postgresql://postgres:postgres@localhost:5432/automation_platform
```

### Manual PostgreSQL Setup

```bash
# Install PostgreSQL 16
# Create database
createdb automation_platform

# Update .env file
DATABASE_URL="postgresql://user:password@localhost:5432/automation_platform"

# Apply schema
npm run prisma:push

# Seed initial data
npm run prisma:seed
```

## Seeding

The seed script creates:

1. **Default Roles:**
   - admin (full access)
   - operator (module management)
   - viewer (read-only)

2. **Default Admin User:**
   - Email: `admin@automation-platform.local`
   - Password: `admin123`
   - Role: admin

```bash
# Run seed
npm run prisma:seed
```

## Prisma Commands

```bash
# Generate Prisma Client
npm run prisma:generate

# Push schema to database (dev)
npm run prisma:push

# Create migration
npm run prisma:migrate

# Seed database
npm run prisma:seed

# Open Prisma Studio (GUI)
npm run prisma:studio

# Full setup (push + seed)
npm run db:setup
```

## Connection Pooling

Prisma handles connection pooling automatically with these defaults:

- **Pool size**: Based on database connection limit
- **Timeout**: 10 seconds
- **Connection lifetime**: Unlimited

For production, consider using **PgBouncer** for external connection pooling.

## Backup & Recovery

### Backup

```bash
# Full database backup
pg_dump -h localhost -U postgres automation_platform > backup.sql

# Schema only
pg_dump -h localhost -U postgres --schema-only automation_platform > schema.sql

# Data only
pg_dump -h localhost -U postgres --data-only automation_platform > data.sql
```

### Restore

```bash
# Restore from backup
psql -h localhost -U postgres automation_platform < backup.sql
```

## Performance Considerations

### Indexes

All frequently queried columns have indexes:
- User lookups: `email`, `username`
- Job queries: `status`, `moduleName`, `scheduledAt`
- Audit queries: `userId`, `action`, `createdAt`

### Query Optimization

- Use `prisma.$queryRaw` for complex queries
- Enable query logging in development
- Monitor slow queries with PostgreSQL logs

### Scaling

For high-traffic deployments:
- Enable **read replicas** for query offloading
- Use **TimescaleDB** for time-series data (future)
- Implement **caching** with Redis (future)

## Security

### Database Access

- **Least Privilege**: Application user has only required permissions
- **No Direct Access**: Database not exposed to public internet
- **SSL/TLS**: Enforce encrypted connections in production

### Sensitive Data

- **Passwords**: Bcrypt hashed (never stored in plaintext)
- **Tokens**: Refresh tokens stored hashed (future enhancement)
- **Audit Logs**: Retain for compliance (configurable retention)

### SQL Injection Prevention

- **Prisma ORM**: Parameterized queries by default
- **Raw Queries**: Use template literals with sanitization

## Monitoring

### Health Checks

- `/health/ready` endpoint checks database connectivity
- Returns 503 if database is unreachable

### Metrics to Monitor

- Connection pool usage
- Query response times
- Table sizes and growth
- Index hit rates
- Lock contention

## Future Enhancements

- [ ] TimescaleDB extension for time-series data
- [ ] Full-text search with PostgreSQL
- [ ] Database sharding for horizontal scaling
- [ ] Automated backup scheduling
- [ ] Point-in-time recovery setup
- [ ] Read replica configuration

---

**Version**: 1.0.0
**Last Updated**: January 2026
