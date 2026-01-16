/**
 * Main App component with routing
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import OfflineBanner from './components/OfflineBanner';
import LoadingSpinner from './components/LoadingSpinner';
import ProtectedRoute from './components/ProtectedRoute';
import './index.css';

// Code-split routes for better initial load performance
// Auth pages are eagerly loaded (needed immediately)
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Lazy load all other pages
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ModulesPage = lazy(() => import('./pages/ModulesPage'));
const JobsPage = lazy(() => import('./pages/JobsPage'));
const CreateJobPage = lazy(() => import('./pages/CreateJobPage'));
const ExecutionsPage = lazy(() => import('./pages/ExecutionsPage'));
const ExecutionDetailPage = lazy(() => import('./pages/ExecutionDetailPage'));
const EventsPage = lazy(() => import('./pages/EventsPage'));
const LiveDashboardPage = lazy(() => import('./pages/LiveDashboardPage'));
const EndpointsPage = lazy(() => import('./pages/EndpointsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh for this duration
      gcTime: 10 * 60 * 1000,   // 10 minutes - cache garbage collection time
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <OfflineBanner />
          <BrowserRouter>
            <Suspense fallback={<LoadingSpinner text="Loading..." />}>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                {/* Protected routes with Layout */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <DashboardPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
              <Route
                path="/modules"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ModulesPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/jobs"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <JobsPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/jobs/new"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <CreateJobPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/jobs/:jobId/executions"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ExecutionsPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/executions"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ExecutionsPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/executions/:id"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ExecutionDetailPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/events"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <EventsPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Consumption Monitoring Routes */}
              <Route
                path="/consumption/live"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <LiveDashboardPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/consumption/endpoints"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <EndpointsPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/consumption/reports"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ReportsPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/consumption/history"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <HistoryPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
