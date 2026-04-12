// src/App.jsx
import React, { useEffect, useRef, useState } from 'react';
import { TOTAL_H } from './config/constants';
import { createInkEngine } from './engine/InkEngine';
import "./index.css";

export default function App() {
  const pixiContainer = useRef(null);
  const engineRef = useRef(null); // 用來儲存引擎的控制方法
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 確保 PIXI 載入後再啟動引擎
    if (window.PIXI) {
      init();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js';
      script.onload = init;
      document.body.appendChild(script);
    }

    return () => {
      // 離開頁面時，安全摧毀引擎，釋放顯卡記憶體
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  const init = () => {
    if (engineRef.current) return;
    
    // 啟動引擎，並將回傳的控制方法存入 useRef
    engineRef.current = createInkEngine(pixiContainer.current);
    setIsReady(true);
  };

  return (
    <div className="flex flex-col items-center py-10 min-h-screen bg-[#2A2B2E] text-[#E8E4D9] font-sans">
      <div className="mb-6 text-center px-4">
        <h1 className="text-2xl font-bold mb-2 tracking-widest text-amber-100">完美水墨：模組化重構版</h1>
      </div>

      <div 
        ref={pixiContainer} 
        className="rounded-sm shadow-2xl border-4 border-[#111315] relative overflow-hidden"
        style={{ width: '400px', height: `${TOTAL_H}px` }}
      >
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#E8E4D9] text-[#1A1C20]">
            研墨載入中...
          </div>
        )}
      </div>

      <div className="mt-8 flex gap-4 fixed bottom-8 z-10 bg-[#2A2B2E]/80 backdrop-blur px-6 py-4 rounded-full border border-gray-700 shadow-2xl">
        {/* 直接呼叫引擎暴露出來的方法 */}
        <button 
          onClick={() => engineRef.current && engineRef.current.spawnWord()}
          className="px-6 py-2 bg-transparent hover:bg-white/10 rounded-full border"
        >
          流出詞彙
        </button>
        <button 
          onClick={() => engineRef.current && engineRef.current.triggerCryingSequence()}
          className="px-6 py-2 bg-amber-700 hover:bg-amber-600 rounded-full"
        >
          情緒崩潰 (10秒)
        </button>
      </div>
    </div>
  );
}