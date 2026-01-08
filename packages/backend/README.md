# Backend - Automation Platform

Core Platform Services & API for the Data Center Automation Platform.

## Features

- ✅ **Fastify Server** - High-performance HTTP server
- ✅ **JWT Authentication** - Secure token-based authentication
- ✅ **RBAC** - Role-Based Access Control (admin, operator, viewer)
- ✅ **Prisma ORM** - Type-safe database access
- ✅ **PostgreSQL** - Relational database with JSON support
- ✅ **Structured Logging** - Pino logger with pretty printing
- ✅ **Health Checks** - Kubernetes-ready liveness/readiness probes

## Prerequisites

- Node.js >= 20.0.0
- PostgreSQL >= 16
- Redis >= 7.0 (for future phases)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the example environment file and customize it:

```bash
cp .env.example .env
```

Edit `.env` and update the following:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT signing
- `REFRESH_TOKEN_SECRET` - Secret key for refresh tokens

### 3. Set Up Database

```bash
# Push schema to database and run seed
npm run db:setup
```

This will:
- Create database tables from Prisma schema
- Seed initial roles (admin, operator, viewer)
- Create default admin user

**Default Admin Credentials:**
- Email: `admin@automation-platform.local`
- Password: `admin123`

⚠️ **Change the admin password immediately in production!**

### 4. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:4000`

## API Endpoints

### Health Checks

- `GET /health` - General health check
- `GET /health/live` - Liveness probe (K8s)
- `GET /health/ready` - Readiness probe (K8s)

### Authentication (`/api/v1/auth`)

#### Register User
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "username",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@automation-platform.local",
  "password": "admin123"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900000
  }
}
```

#### Refresh Token
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

#### Get Current User
```http
GET /api/v1/auth/me
Authorization: Bearer <access-token>
```

#### Logout
```http
POST /api/v1/auth/logout
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

## Database Schema

### Core Tables

- **users** - User accounts
- **roles** - System roles (admin, operator, viewer)
- **user_roles** - User-to-role assignments
- **sessions** - Refresh token sessions
- **modules** - Installed automation modules
- **jobs** - Background job queue
- **audit_logs** - Audit trail

## Roles & Permissions

### Admin
Full system access with wildcard permission `*:*`

### Operator
- `modules:read`, `modules:write`, `modules:execute`
- `jobs:read`, `jobs:write`
- `users:read`

### Viewer
- `modules:read`
- `jobs:read`
- `users:read`

## Development

### Available Scripts

```bash
# Development mode with hot reload
npm run dev

# Build TypeScript
npm run build

# Start production server
npm start

# Run tests
npm run test

# Type checking
npm run typecheck

# Linting
npm run lint

# Prisma commands
npm run prisma:generate    # Generate Prisma client
npm run prisma:migrate     # Create and run migrations
npm run prisma:push        # Push schema to database
npm run prisma:seed        # Seed database
npm run prisma:studio      # Open Prisma Studio GUI

# Database setup (push + seed)
npm run db:setup
```

### Project Structure

```
packages/backend/
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Seed data
├── src/
│   ├── config/
│   │   ├── env.ts          # Environment configuration
│   │   └── logger.ts       # Logger setup
│   ├── lib/
│   │   └── prisma.ts       # Prisma client
│   ├── middleware/
│   │   └── auth.middleware.ts  # Auth middleware
│   ├── routes/
│   │   └── auth.routes.ts  # Auth endpoints
│   ├── services/
│   │   └── auth.service.ts # Auth business logic
│   ├── app.ts              # Fastify app setup
│   └── index.ts            # Entry point
├── .env.example            # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

## Security Notes

1. **JWT Secrets**: Change `JWT_SECRET` and `REFRESH_TOKEN_SECRET` in production
2. **Admin Password**: Change default admin password immediately
3. **CORS**: Configure proper CORS origins in production (currently allows all in dev)
4. **Database**: Use strong PostgreSQL credentials
5. **Environment**: Never commit `.env` file to version control

## Next Steps

- [ ] Add user management endpoints
- [ ] Implement module management routes
- [ ] Add job scheduler integration
- [ ] Set up Redis for session storage
- [ ] Add rate limiting
- [ ] Implement audit logging endpoints

## Troubleshooting

### Database Connection Issues

If you get connection errors:
1. Verify PostgreSQL is running
2. Check `DATABASE_URL` in `.env`
3. Ensure database exists: `createdb automation_platform`

### Prisma Client Not Found

Run:
```bash
npm run prisma:generate
```

### Port Already in Use

Change `PORT` in `.env` or kill the process using port 4000:
```bash
# Windows
netstat -ano | findstr :4000

# Linux/Mac
lsof -ti:4000 | xargs kill
```
