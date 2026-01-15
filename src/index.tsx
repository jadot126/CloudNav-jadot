import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import InitSetupPage from './pages/InitSetupPage';

// Mock API 现在由 Vite 开发服务器中间件处理（见 vite.config.ts）
// 不再需要在浏览器端拦截 fetch 请求
if (import.meta.env.DEV) {
  console.log('[CloudNav] Development mode - Mock API handled by Vite server middleware');
}

// 应用入口组件，处理初始化检查
function AppEntry() {
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 检查是否已初始化
  useEffect(() => {
    const checkInit = async () => {
      try {
        const response = await fetch('/api/storage?checkInit=true');
        const data = await response.json() as { initialized?: boolean };
        setIsInitialized(data.initialized ?? false);
      } catch (error) {
        console.error('Failed to check initialization:', error);
        // 如果检查失败，假设未初始化
        setIsInitialized(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkInit();
  }, []);

  // 加载中显示
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400">加载中...</p>
        </div>
      </div>
    );
  }

  // 路由配置
  return (
    <Routes>
      {/* 初始化设置页面 */}
      <Route
        path="/setup"
        element={
          isInitialized ? (
            <Navigate to="/" replace />
          ) : (
            <InitSetupPage onSetupComplete={() => setIsInitialized(true)} />
          )
        }
      />

      {/* 主应用 - 支持分组路由 */}
      <Route
        path="/*"
        element={
          isInitialized === false ? (
            <Navigate to="/setup" replace />
          ) : (
            <App />
          )
        }
      />
    </Routes>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AppEntry />
    </BrowserRouter>
  </React.StrictMode>
);
