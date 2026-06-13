import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout } from './components/Layout'
import LandingPage from './pages/LandingPage'
import AuthPage from './pages/auth/AuthPage'
import OAuthCallback from './pages/auth/OAuthCallback'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import VerifyEmailPage from './pages/auth/VerifyEmailPage'
import HomePage from './pages/home/HomePage'
import { DatasetList } from './pages/datasets/DatasetList'
import { DatasetDetail } from './pages/datasets/DatasetDetail'
import { PipelineList } from './pages/pipelines/PipelineList'
import { PipelineEditor } from './pages/pipelines/PipelineEditor'
import { SyntheticPage } from './pages/synthetic/SyntheticPage'
import ActiveLearningPage from './pages/active-learning/ActiveLearningPage'
import BenchmarkPage from './pages/benchmark/BenchmarkPage'
import MarketplacePage from './pages/marketplace/MarketplacePage'
import SettingsPage from './pages/settings/SettingsPage'
import CompliancePage from './pages/compliance/CompliancePage'
import DocsPage from './pages/docs/DocsPage'
import ProfilePage from './pages/profile/ProfilePage'
import OrgsPage from './pages/orgs/OrgsPage'
import BillingPage from './pages/billing/BillingPage'

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <Routes>
              {/* Public */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<AuthPage />} />
              <Route path="/auth/callback" element={<OAuthCallback />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />

              {/* Protected — every route inside Layout requires auth */}
              <Route
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <Layout />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              >
                <Route path="/home" element={<HomePage />} />
                <Route path="/datasets" element={<DatasetList />} />
                <Route path="/datasets/:id" element={<DatasetDetail />} />
                <Route path="/pipelines" element={<PipelineList />} />
                <Route path="/pipelines/:id" element={<PipelineEditor />} />
                <Route path="/synthetic" element={<SyntheticPage />} />
                <Route path="/active-learning" element={<ActiveLearningPage />} />
                <Route path="/benchmark" element={<BenchmarkPage />} />
                <Route path="/compliance" element={<CompliancePage />} />
                <Route path="/marketplace" element={<MarketplacePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/docs" element={<DocsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/orgs" element={<OrgsPage />} />
                <Route path="/billing" element={<BillingPage />} />
                <Route path="*" element={<Navigate to="/home" replace />} />
              </Route>
            </Routes>
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
