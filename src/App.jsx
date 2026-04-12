// src/App.jsx
import React, { useEffect, useRef, useState } from 'react';
import { TOTAL_H, MONITOR_H } from './config/constants';
import { createInkEngine } from './engine/InkEngine';

export default function App() {
  const pixiContainer = useRef(null);
  const videoRef = useRef(null);
  const engineRef = useRef(null); 
  
  const eyeCoordsRef = useRef(null);
  const [status, setStatus] = useState("載入 AI 模組中...");

  useEffect(() => {
    const loadDependencies = async () => {
      // 載入 PIXI
      if (!window.PIXI) {
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js';
          script.onload = resolve;
          document.body.appendChild(script);
        });
      }
      
      // 啟動攝影機
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise((resolve) => { videoRef.current.onloadedmetadata = resolve; });
          videoRef.current.play();
        }
      } catch (err) {
        console.error("相機權限被拒絕", err);
        setStatus("⚠️ 請允許相機權限");
      }

      // 載入 MediaPipe 
      try {
        const visionModule = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs');
        const vision = await visionModule.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
        const faceLandmarker = await visionModule.FaceLandmarker.createFromOptions(vision, {
          baseOptions: { 
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", 
            delegate: "GPU" 
          },
          runningMode: "VIDEO",
          numFaces: 1
        });

        setStatus("✅ 眼睛追蹤運行中");
        startTracking(faceLandmarker);
      } catch (err) {
        console.error(err);
        setStatus("⚠️ AI 模組載入失敗");
      }

      // 啟動引擎
      if (!engineRef.current) {
        engineRef.current = createInkEngine(pixiContainer.current, () => eyeCoordsRef.current);
      }
    };

    loadDependencies();

    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  const startTracking = (faceLandmarker) => {
    let lastVideoTime = -1;
    const loop = () => {
      if (videoRef.current && videoRef.current.currentTime !== lastVideoTime) {
        lastVideoTime = videoRef.current.currentTime;
        const results = faceLandmarker.detectForVideo(videoRef.current, performance.now());

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const marks = results.faceLandmarks[0];
          
          eyeCoordsRef.current = {
            leftOuter: { x: marks[33].x * 400, y: marks[33].y * MONITOR_H },
            leftInner: { x: marks[133].x * 400, y: marks[133].y * MONITOR_H },
            rightInner: { x: marks[362].x * 400, y: marks[362].y * MONITOR_H },
            rightOuter: { x: marks[263].x * 400, y: marks[263].y * MONITOR_H }
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
        <h1 className="text-2xl font-bold mb-2 tracking-widest text-amber-100">0.7.0：即時眼睛追蹤</h1>
        <p className="text-sm text-gray-400">{status}</p>
      </div>

      <div className="flex gap-8 items-start">
        <div className="flex flex-col items-center">
            <p className="text-xs text-gray-500 mb-2">相機視野 (鏡像)</p>
            <video 
                ref={videoRef} 
                className="w-48 rounded-xl border border-gray-600 transform -scale-x-100" 
                playsInline muted autoPlay
            />
        </div>

        <div 
          ref={pixiContainer} 
          className="rounded-sm shadow-2xl border-4 border-[#111315] relative overflow-hidden bg-[#E8E4D9]"
          style={{ width: '400px', height: `${TOTAL_H}px` }}
        />
      </div>

      <div className="mt-8 flex gap-4 fixed bottom-8 z-10 bg-[#2A2B2E]/80 backdrop-blur px-6 py-4 rounded-full border border-gray-700 shadow-2xl">
        <button 
          onClick={() => engineRef.current && engineRef.current.spawnWord()}
          className="px-6 py-2 bg-transparent hover:bg-white/10 rounded-full border"
        >
          流出單一詞彙
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