# Frontend - Automation Platform

Web Control Plane SPA for the Data Center Automation Platform.

## Features

- ✅ **React 18+** with TypeScript
- ✅ **React Router** for navigation
- ✅ **Authentication** with JWT tokens
- ✅ **Protected Routes** with automatic redirect
- ✅ **Dark/Light Theme** with system preference detection
- ✅ **API Integration** with automatic token refresh
- ✅ **Tailwind CSS** for styling
- ✅ **React Query** for server state management
- ✅ **Responsive Design** with mobile support

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` if needed (default points to `http://localhost:4000/api/v1`).

### 3. Start Development Server

```bash
npm run dev
```

The frontend will start on `http://localhost:3000`.

## Project Structure

```
packages/frontend/
├── src/
│   ├── api/
│   │   ├── client.ts          # Axios client with interceptors
│   │   └── auth.ts            # Authentication API calls
│   ├── components/
│   │   └── ProtectedRoute.tsx # Route guard component
│   ├── contexts/
│   │   ├── AuthContext.tsx    # Authentication state
│   │   └── ThemeContext.tsx   # Theme state (dark/light)
│   ├── pages/
│   │   ├── LoginPage.tsx      # Login page
│   │   ├── RegisterPage.tsx   # Registration page
│   │   └── DashboardPage.tsx  # Main dashboard
│   ├── App.tsx                # Main app with routing
│   ├── main.tsx               # Entry point
│   └── index.css              # Tailwind imports
├── index.html
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

## Available Scripts

```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Features

### Authentication

The app includes a complete authentication flow:

1. **Login** - Sign in with email/password
2. **Register** - Create a new account
3. **Auto Token Refresh** - Automatically refreshes expired tokens
4. **Protected Routes** - Redirects to login if not authenticated
5. **Logout** - Clears tokens and redirects to login

### Default Credentials

For development, use these credentials:

```
Email: admin@automation-platform.local
Password: admin123
```

### Theme Support

The app supports dark and light modes:

- Toggle with the button in the header
- Preference is saved to localStorage
- Uses Tailwind's dark mode classes

### API Integration

The API client includes:

- **Automatic Token Attachment** - Adds JWT to requests
- **Token Refresh** - Automatically refreshes on 401 errors
- **Request/Response Interceptors** - Centralized error handling
- **TypeScript Types** - Fully typed API responses

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API base URL | `http://localhost:4000/api/v1` |

## Routes

| Path | Component | Protected | Description |
|------|-----------|-----------|-------------|
| `/` | Redirect | No | Redirects to `/dashboard` |
| `/login` | LoginPage | No | User login |
| `/register` | RegisterPage | No | User registration |
| `/dashboard` | DashboardPage | Yes | Main dashboard |

## Development

### Adding New Pages

1. Create component in `src/pages/`
2. Add route in `App.tsx`
3. Wrap with `<ProtectedRoute>` if needed

### Adding API Endpoints

1. Add TypeScript types in `src/api/`
2. Create API functions using `apiClient`
3. Use with React Query for caching

Example:

```typescript
// src/api/modules.ts
export const modulesApi = {
  async getAll() {
    return apiClient.get<Module[]>('/modules');
  },
};

// In component
import { useQuery } from '@tanstack/react-query';
import { modulesApi } from '../api/modules';

const { data, isLoading } = useQuery({
  queryKey: ['modules'],
  queryFn: modulesApi.getAll,
});
```

## Building for Production

```bash
# Build
npm run build

# Output is in dist/
# Serve with any static file server
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Next Steps

After Phase 1, the following will be added:

- Module management UI
- Job monitoring dashboard
- User management
- Real-time notifications
- Advanced permissions UI

---

**Version**: 1.0.0 | **Phase**: 1 - Foundation Complete
