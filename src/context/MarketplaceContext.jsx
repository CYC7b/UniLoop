import React from 'react'
import { AuthProvider } from './AuthContext'
import { ChatProvider } from './ChatContext'
import { ProductProvider } from './ProductContext'
import { UIProvider } from './UIContext'

export const MarketplaceProvider = ({ children }) => (
  <UIProvider>
    <AuthProvider>
      <ProductProvider>
        <ChatProvider>
          {children}
        </ChatProvider>
      </ProductProvider>
    </AuthProvider>
  </UIProvider>
)
