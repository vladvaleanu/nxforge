# Database Quick Start Guide

Fast track guide to get the database running for the Automation Platform.

## Option 1: Docker Compose (Easiest)

### 1. Start Database Services

```bash
# From project root
docker-compose up -d

# Verify services are running
docker-compose ps
```

This starts:
- PostgreSQL 16 on port 5432
- Redis 7 on port 6379

### 2. Set Up Database

```bash
cd packages/backend

# Copy environment file
cp .env.example .env

# The default DATABASE_URL is already configured for Docker:
# postgresql://postgres:postgres@localhost:5432/automation_platform

# Apply schema and seed data
npm run db:setup
```

### 3. Verify

```bash
# Start the backend
npm run dev

# Check health endpoint
curl http://localhost:4000/health/ready
```

Expected response:
```json
{
  "status": "ok",
  "checks": {
    "database": "ok",
    "redis": "not_configured"
  }
}
```

✅ **Done! Database is ready.**

---

## Option 2: Manual PostgreSQL Installation

### 1. Install PostgreSQL

**Windows:**
- Download from https://www.postgresql.org/download/windows/
- Install and note the password you set

**macOS:**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql-16 postgresql-contrib-16
sudo systemctl start postgresql
```

### 2. Create Database

```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE automation_platform;

# Create user (optional, for non-postgres user)
CREATE USER automation_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE automation_platform TO automation_user;

# Exit
\q
```

### 3. Configure Backend

```bash
cd packages/backend

# Copy environment file
cp .env.example .env

# Edit .env and update DATABASE_URL
# For postgres user:
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/automation_platform"

# Or for custom user:
DATABASE_URL="postgresql://automation_user:your_password@localhost:5432/automation_platform"
```

### 4. Apply Schema

```bash
# Install dependencies
npm install

# Push schema and seed
npm run db:setup
```

✅ **Done! Database is ready.**

---

## Common Commands

### Database Management

```bash
# Apply schema changes
npm run prisma:push

# Create migration
npm run prisma:migrate

# Seed data (roles + admin user)
npm run prisma:seed

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Open Prisma Studio (database GUI)
npm run prisma:studio
```

### Docker Compose

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v

# View logs
docker-compose logs -f postgres

# Restart a service
docker-compose restart postgres
```

### Connecting to Database

```bash
# Using Docker
docker-compose exec postgres psql -U postgres -d automation_platform

# Using local PostgreSQL
psql -U postgres -d automation_platform

# Useful psql commands:
\dt          # List tables
\d users     # Describe users table
\du          # List users/roles
\l           # List databases
\q           # Quit
```

---

## Default Credentials

### Database (Docker)
- **User**: `postgres`
- **Password**: `postgres`
- **Database**: `automation_platform`
- **Port**: `5432`

### Application Admin
- **Email**: `admin@automation-platform.local`
- **Password**: `admin123`

⚠️ **Change these in production!**

---

## Troubleshooting

### "Connection refused"

**Docker:**
```bash
# Check if container is running
docker-compose ps

# Check logs
docker-compose logs postgres

# Restart
docker-compose restart postgres
```

**Local:**
```bash
# Check if PostgreSQL is running
# Linux/macOS:
sudo systemctl status postgresql

# macOS (brew):
brew services list

# Windows:
# Check Services app for PostgreSQL service
```

### "Database does not exist"

```bash
# Create the database
createdb -U postgres automation_platform

# Or using psql
psql -U postgres
CREATE DATABASE automation_platform;
```

### "Prisma Client not found"

```bash
npm run prisma:generate
```

### "Permission denied"

Make sure your DATABASE_URL user has the correct permissions:
```sql
GRANT ALL PRIVILEGES ON DATABASE automation_platform TO your_user;
```

### Port 5432 already in use

```bash
# Find what's using the port
# Windows:
netstat -ano | findstr :5432

# Linux/macOS:
lsof -ti:5432

# Kill the process or change the port in docker-compose.yml
```

---

## Database Schema Overview

The database includes these core tables:

| Table | Purpose |
|-------|---------|
| `users` | User accounts |
| `roles` | System roles (admin, operator, viewer) |
| `user_roles` | User-role assignments |
| `sessions` | Refresh token sessions |
| `modules` | Installed automation modules |
| `jobs` | Background job queue |
| `audit_logs` | Security audit trail |

See [database.md](./database.md) for complete schema documentation.

---

## Next Steps

After database setup:

1. ✅ Database is running
2. ✅ Schema is applied
3. ✅ Default admin user created
4. ➡️ Start the backend: `npm run dev`
5. ➡️ Test login with admin credentials
6. ➡️ Build the frontend

---

**Need help?** Check the [full database documentation](./database.md)
