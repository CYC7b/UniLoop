import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { getToken, clearToken } from './lib/api'
import { LangProvider } from './context/LangContext.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Users from './pages/Users.jsx'
import Products from './pages/Products.jsx'
import Reports from './pages/Reports.jsx'

const App = () => {
  const [token, setToken] = useState(getToken())

  const handleLogin = (t) => setToken(t)
  const handleLogout = () => { clearToken(); setToken(null) }

  return (
    <LangProvider>
      {!token ? (
        <Login onLogin={handleLogin} />
      ) : (
        <BrowserRouter>
          <Layout onLogout={handleLogout}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/users" element={<Users />} />
              <Route path="/products" element={<Products />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      )}
    </LangProvider>
  )
}

export default App
