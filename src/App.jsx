// src/App.jsx
import React, { useEffect, useRef, useState } from 'react';
import { TOTAL_H, MONITOR_H, GAP_H, TABLET_START_Y, TABLET_H } from './config/constants';
import { createInkEngine } from './engine/InkEngine';

export default function App() {
  const pixiContainer = useRef(null);
  const videoRef = useRef(null);
  const engineRef = useRef(null); 
  const eyeCoordsRef = useRef(null);
  
  const [interactionState, setInteractionState] = useState('init');

  useEffect(() => {
    const initPixiScript = async () => {
      if (!window.PIXI) {
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = ['https:/', '/cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js'].join('');
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

  const initCameraAndAI = async () => {
    setInteractionState('loading');

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
      alert("請允許相機權限才能體驗作品！");
      setInteractionState('init');
      return; 
    }

    let faceLandmarker;
    try {
      const mpBase = ['https:/', '/cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3'].join('');
      const modelBase = ['https:/', '/storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'].join('');

      const visionModule = await import(/* @vite-ignore */ mpBase + '/vision_bundle.mjs');
      const vision = await visionModule.FilesetResolver.forVisionTasks(mpBase + '/wasm');
      
      faceLandmarker = await visionModule.FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: modelBase, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 1
      });
    } catch (err) {
      console.error(err);
      alert("AI 模組載入失敗");
      setInteractionState('init');
      return;
    }

    if (!engineRef.current && videoRef.current) {
      engineRef.current = createInkEngine(
        pixiContainer.current, 
        () => eyeCoordsRef.current, 
        videoRef.current,
        () => setInteractionState('finished') 
      );
    }

    if (faceLandmarker) {
        startTracking(faceLandmarker);
        setInteractionState('ready'); 
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

  const handleSpawnWord = () => {
    setInteractionState('playing');
    if (engineRef.current) engineRef.current.spawnWord();
  };

  const handleCrying = () => {
    setInteractionState('playing');
    if (engineRef.current) engineRef.current.triggerCryingSequence();
  };

  const handleTryAgain = () => {
    setInteractionState('ready');
  };

  return (
    <div className="flex flex-col items-center py-6 min-h-screen bg-[#2A2B2E] text-[#E8E4D9] font-sans">
      <div className="mb-4 text-center px-4">
        <h1 className="text-2xl font-bold mb-2 tracking-widest text-amber-100">0.7.4：寶石煉化與延遲 UI 版</h1>
      </div>

      <div className="relative rounded-sm shadow-2xl border-4 border-[#111315] overflow-hidden bg-[#E8E4D9]" style={{ width: '400px', height: `${TOTAL_H}px` }}>
        
        <div className="absolute inset-0 flex flex-col pointer-events-none z-0">
          <div style={{ height: `${MONITOR_H}px` }} className="w-full bg-[#111315]"></div> 
          <div style={{ height: `${GAP_H}px` }} className="w-full bg-[#1A1C20]"></div>     
          <div style={{ height: `${TABLET_H}px` }} className="w-full bg-[#E8E4D9]"></div> 
        </div>

        <video ref={videoRef} playsInline muted autoPlay style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }} />

        <div ref={pixiContainer} className="absolute inset-0 z-10" />

        {/* 【空間調整】移除 justify-center，改用絕對的 top 距離，將 UI 釘在平板最上方 */}
        <div 
          className="absolute left-0 w-full flex justify-center pointer-events-none z-20"
          style={{ top: `${TABLET_START_Y + 32}px` }}
        >
          <div className={`pointer-events-auto transition-opacity duration-700 ${interactionState === 'playing' ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
            
            {interactionState === 'init' && (
              <div className="flex flex-col items-center gap-4 bg-[#1A1C20]/85 backdrop-blur-md px-10 py-8 rounded-3xl border border-gray-700 shadow-2xl w-[300px]">
                <p className="text-gray-300 text-sm font-light tracking-widest">點擊以啟動互動裝置</p>
                <button onClick={initCameraAndAI} className="w-full px-8 py-3 bg-[#1d4ed8] hover:bg-blue-600 rounded-full font-bold shadow-lg text-white text-lg tracking-widest transition-transform active:scale-95">
                  啟動鏡頭與 AI
                </button>
              </div>
            )}
            
            {interactionState === 'loading' && (
              <div className="flex flex-col items-center gap-4 bg-[#1A1C20]/85 backdrop-blur-md px-10 py-8 rounded-3xl border border-gray-700 shadow-2xl w-[300px]">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-white tracking-widest text-sm">模組載入中...</span>
              </div>
            )}

            {interactionState === 'ready' && (
              <div className="flex flex-col items-center gap-4 bg-[#1A1C20]/85 backdrop-blur-md px-10 py-8 rounded-3xl border border-gray-700 shadow-2xl w-[300px]">
                <p className="text-gray-300 text-sm mb-2 font-light">請選擇您的情緒出口</p>
                <button onClick={handleSpawnWord} className="w-full px-6 py-3 bg-[#2A2B2E] hover:bg-[#3f3f46] rounded-full border border-gray-500 text-white tracking-wider transition-transform active:scale-95">
                  流出單一詞彙
                </button>
                <button onClick={handleCrying} className="w-full px-6 py-3 bg-[#c2410c] hover:bg-[#9a3412] rounded-full shadow-lg text-white tracking-wider font-bold transition-transform active:scale-95">
                  情緒崩潰 (10秒)
                </button>
              </div>
            )}

            {interactionState === 'finished' && (
              <div className="flex flex-col items-center gap-4 bg-[#1A1C20]/85 backdrop-blur-md px-10 py-8 rounded-3xl border border-gray-700 shadow-2xl w-[300px]">
                <p className="text-gray-300 text-sm font-light tracking-widest">情緒已宣洩完畢</p>
                <button onClick={handleTryAgain} className="w-full px-10 py-3 bg-emerald-700 hover:bg-emerald-600 rounded-full font-bold shadow-lg text-white tracking-widest text-lg transition-transform active:scale-95">
                  再次體驗
                </button>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}