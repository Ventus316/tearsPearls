// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MonitorView from './views/MonitorView';
import TabletView from './views/TabletView';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 顯示器專用路由：http://localhost:5173/monitor */}
        <Route path="/monitor" element={<MonitorView />} />
        
        {/* 平板專用路由：http://localhost:5173/tablet */}
        <Route path="/tablet" element={<TabletView />} />
        
        {/* 預設首頁自動導向到平板，或是你可以做一個導覽頁 */}
        <Route path="*" element={<Navigate to="/tablet" replace />} />
      </Routes>
    </BrowserRouter>
  );
}