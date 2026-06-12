import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from './components/Layout'
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

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/datasets" replace />} />
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
            <Route path="*" element={<Navigate to="/datasets" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

function ComingSoon({ label, phase }: { label: string; phase: number }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-32 text-center">
      <div className="text-4xl mb-4">🔜</div>
      <h2 className="text-lg font-semibold text-text-primary">{label}</h2>
      <p className="text-sm text-text-secondary mt-1">Coming in Phase {phase}</p>
    </div>
  )
}
