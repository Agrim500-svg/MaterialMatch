import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ScrollToTop from './components/ScrollToTop'
import HomePage from './pages/HomePage'
import AnalysisPage from './pages/AnalysisPage'
import ExplorePage from './pages/ExplorePage'
import CandidatesPage from './pages/CandidatesPage'
import AssistantPage from './pages/AssistantPage'

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/analyze" element={<Navigate to="/" replace />} />
          <Route path="/analyze/:formula" element={<AnalysisPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/candidates" element={<CandidatesPage />} />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
