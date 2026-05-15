import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import './index.css'

// Leaflet 默认图标修复（Vite 打包环境下必须手动配置）
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

import { MarketplaceProvider } from './context/MarketplaceContext.jsx'
import { useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import ProductDetail from './pages/ProductDetail.jsx'
import Upload from './pages/Upload.jsx'
import Profile from './pages/Profile.jsx'
import Welcome from './pages/Welcome.jsx'
import Inbox from './pages/Inbox.jsx'
import ChatRoom from './pages/ChatRoom.jsx'
import Auth from './pages/Auth.jsx'
import EditProduct from './pages/EditProduct.jsx'
import NotFound from './pages/NotFound.jsx'
import UserProfile from './pages/UserProfile.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// 路由守卫：需要登录才能访问的页面
const RequireAuth = ({ children }) => {
  const { session, authLoading } = useAuth()
  const location = useLocation()

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-uniloop-400/30 border-t-uniloop-500 rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!session) {
    // 保存用户想去的页面，登录后可以跳回
    return <Navigate to="/auth" state={{ from: location }} replace />
  }

  return children
}

const AppContent = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, authLoading } = useAuth()

  useEffect(() => {
    if (authLoading) return // Do not redirect while checking session
    if (location.pathname === '/') {
      navigate('/home', { replace: true })
    }
  }, [navigate, location.pathname, authLoading])

  return (
    <Routes>
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/auth" element={
        session ? <Navigate to="/home" replace /> : <Auth />
      } />
      <Route element={<Layout />}>
        <Route path="/home" element={<Home key={location.key} />} />
        <Route path="/" element={<Home key={location.key} />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/user/:id" element={<UserProfile />} />
        <Route path="/upload" element={
          <RequireAuth><Upload /></RequireAuth>
        } />
        <Route path="/profile" element={
          <RequireAuth><Profile /></RequireAuth>
        } />
        <Route path="/edit/:id" element={
          <RequireAuth><EditProduct /></RequireAuth>
        } />
        <Route path="/inbox" element={
          <RequireAuth><Inbox /></RequireAuth>
        } />
        <Route path="/chat/:id" element={
          <RequireAuth><ChatRoom /></RequireAuth>
        } />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

const App = () => (
  <MarketplaceProvider>
    <BrowserRouter>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </BrowserRouter>
  </MarketplaceProvider>
)

createRoot(document.getElementById('root')).render(<App />)
