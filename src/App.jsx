// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MonitorView from './views/MonitorView';
import TabletView from './views/TabletView';

/**
 * 展場雙螢幕路由控制中心 (Router)
 * 負責將同一個 React 專案，依據網址分發給實體展場的兩台不同裝置。
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 🖥️ 顯示器專用路由：負責 AI 臉部追蹤、眼淚物理特效與待機圖層 */}
        {/* 佈展機台網址請輸入：http://[伺服器IP]:5173/monitor */}
        <Route path="/monitor" element={<MonitorView />} />
        
        {/* 📱 平板專用路由：負責互動選詞 UI、水波紋特效、寶石結算與 60 秒閒置待機 */}
        {/* 佈展機台網址請輸入：http://[伺服器IP]:5173/tablet */}
        <Route path="/tablet" element={<TabletView />} />
        
        {/* 🔄 預設防呆路由：若輸入根目錄或其他錯誤網址，自動導向平板互動介面 */}
        <Route path="*" element={<Navigate to="/tablet" replace />} />
      </Routes>
    </BrowserRouter>
  );
}