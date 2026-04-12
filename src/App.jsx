// src/App.jsx
import React, { useEffect, useRef, useState } from 'react';
import { TOTAL_H, MONITOR_H } from './config/constants';
import { createInkEngine } from './engine/InkEngine';

// =========================================================================
// 📂 檔案三：本機端的 src/App.jsx
// 【本機端提醒】：請記得寫 import { TOTAL_H, MONITOR_H } from './config/constants';
//              以及 import { createInkEngine } from './engine/InkEngine';
//              並維持 export default function App()
// =========================================================================
export default function App() {
  const pixiContainer = useRef(null);
  const videoRef = useRef(null);
  const engineRef = useRef(null); 
  const eyeCoordsRef = useRef(null);
  const [status, setStatus] = useState("等待啟動...");
  const [isCameraStarted, setIsCameraStarted] = useState(false);

  // 1. 在載入時只初始化 PIXI，不馬上叫相機 (避免被瀏覽器阻擋)
  useEffect(() => {
    const initPixiScript = async () => {
      if (!window.PIXI) {
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js';
          script.onload = resolve;
          document.body.appendChild(script);
        });
      }
    };
    initPixiScript();

    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  // 2. 由使用者「點擊按鈕」觸發，絕對能叫出權限視窗！
  const initCameraAndAI = async () => {
    if (isCameraStarted) return;
    setIsCameraStarted(true);
    setStatus("請求相機權限中...");

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise((resolve) => { 
           videoRef.current.onloadedmetadata = () => {
              videoRef.current.play();
              resolve();
           };
        });
      }
    } catch (err) {
      console.error("相機權限被拒絕", err);
      setStatus("⚠️ 請允許相機權限");
      return; 
    }

    setStatus("載入 AI 模組中...");

    let faceLandmarker;
    try {
      // 鎖定穩定版本 0.10.3，解決 404 Not Found 問題
      const visionModule = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs');
      const vision = await visionModule.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
      faceLandmarker = await visionModule.FaceLandmarker.createFromOptions(vision, {
        baseOptions: { 
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", 
          delegate: "GPU" 
        },
        runningMode: "VIDEO",
        numFaces: 1
      });
      setStatus("✅ AI 與鏡頭運作中");
    } catch (err) {
      console.error(err);
      setStatus("⚠️ AI 模組載入失敗");
    }

    if (!engineRef.current && videoRef.current) {
      engineRef.current = createInkEngine(pixiContainer.current, () => eyeCoordsRef.current, videoRef.current);
    }

    if (faceLandmarker) {
        startTracking(faceLandmarker);
    }
  };

  const startTracking = (faceLandmarker) => {
    let lastVideoTime = -1;
    const loop = () => {
      if (videoRef.current && videoRef.current.currentTime !== lastVideoTime) {
        lastVideoTime = videoRef.current.currentTime;
        const results = faceLandmarker.detectForVideo(videoRef.current, performance.now());

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const marks = results.faceLandmarks[0];
          const vw = videoRef.current.videoWidth;
          const vh = videoRef.current.videoHeight;
          
          const scale = Math.max(400 / vw, MONITOR_H / vh);

          // 核心數學：將 MediaPipe 的原始座標，轉換為 PixiJS 中顯示器區域的對應座標
          const mapPoint = (mark) => {
             const vx = mark.x * vw;         
             const vy = mark.y * vh;         
             const dx = vx - (vw / 2);       
             const dy = vy - (vh / 2);       
             
             const screenX = 200 - (dx * scale);
             const screenY = (MONITOR_H / 2) + (dy * scale);
             
             return { x: screenX, y: screenY };
          };
          
          eyeCoordsRef.current = {
            leftOuter: mapPoint(marks[33]),   
            leftInner: mapPoint(marks[133]),  
            rightInner: mapPoint(marks[362]), 
            rightOuter: mapPoint(marks[263])  
          };
        } else {
          eyeCoordsRef.current = null; 
        }
      }
      requestAnimationFrame(loop);
    };
    loop();
  };

  return (
    <div className="flex flex-col items-center py-6 min-h-screen bg-[#2A2B2E] text-[#E8E4D9] font-sans">
      <div className="mb-4 text-center px-4">
        <h1 className="text-2xl font-bold mb-2 tracking-widest text-amber-100">0.7.1：完美版面與真實追蹤</h1>
        <p className="text-sm text-gray-400">{status}</p>
      </div>

      <div className="flex gap-8 items-start relative">
        {/* 把 HTML 的 video 隱藏但保留功能，避免破壞畫面排版 */}
        <video 
            ref={videoRef} 
            playsInline muted autoPlay
            style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
        />

        {/* 恢復原狀的乾淨顯示器+平板外框 */}
        <div 
          ref={pixiContainer} 
          className="rounded-sm shadow-2xl border-4 border-[#111315] relative overflow-hidden bg-[#E8E4D9]"
          style={{ width: '400px', height: `${TOTAL_H}px` }}
        />
      </div>

      <div className="mt-8 flex gap-4 fixed bottom-8 z-10 bg-[#2A2B2E]/80 backdrop-blur px-6 py-4 rounded-full border border-gray-700 shadow-2xl">
        {!isCameraStarted ? (
          <button 
            onClick={initCameraAndAI}
            className="px-6 py-2 bg-blue-700 hover:bg-blue-600 rounded-full font-bold shadow-lg"
          >
            1. 啟動鏡頭與 AI (請先點擊)
          </button>
        ) : (
          <>
            <button 
              onClick={() => engineRef.current && engineRef.current.spawnWord()}
              className="px-6 py-2 bg-transparent hover:bg-white/10 rounded-full border border-gray-500"
            >
              流出單一詞彙
            </button>
            <button 
              onClick={() => engineRef.current && engineRef.current.triggerCryingSequence()}
              className="px-6 py-2 bg-amber-700 hover:bg-amber-600 rounded-full shadow-lg"
            >
              情緒崩潰 (10秒)
            </button>
          </>
        )}
      </div>
    </div>
  );
}
