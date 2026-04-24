// src/App.jsx
import React, { useEffect, useRef, useState } from 'react';
import { WORDS, TOTAL_H, MONITOR_H, GAP_H, TABLET_START_Y, TABLET_H } from './config/constants';
// import { createInkEngine } from './engine/InkEngine';
// import { createInkEngine } from './engine/style/SakuraInkEngine';
// import { createInkEngine } from './engine/style/Fallingleaves';
import { createInkEngine } from './engine/style/Hearts';

export default function App() {
  const pixiContainer = useRef(null);
  const videoRef = useRef(null);
  const engineRef = useRef(null); 
  const eyeCoordsRef = useRef(null);
  
  const [interactionState, setInteractionState] = useState('init');
  const [selectedWords, setSelectedWords] = useState([]);

  useEffect(() => {
    const initPixiScript = async () => {
      if (!window.PIXI) {
        // 第一步：載入 PIXI 主程式
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = ['https:/', '/cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js'].join('');
          script.onload = async () => {
            // 第二步：PIXI 載入完成後，載入 pixi-filters 擴充包 (提供 Bloom 等高級濾鏡)
            const filterScript = document.createElement('script');
            filterScript.src = ['https:/', '/cdn.jsdelivr.net/npm/pixi-filters@5.2.1/dist/pixi-filters.js'].join('');
            filterScript.onload = resolve;
            document.body.appendChild(filterScript);
          };
          document.body.appendChild(script);
        });
      }
    };
    initPixiScript();
    return () => { if (engineRef.current) { engineRef.current.destroy(); engineRef.current = null; } };
  }, []);

  const initCameraAndAI = async () => {
    setInteractionState('loading');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise((resolve) => { videoRef.current.onloadedmetadata = () => { videoRef.current.play(); resolve(); }; });
      }
    } catch (err) { alert("請允許相機權限！"); setInteractionState('init'); return; }

    try {
      // 確保使用陣列 join 組合網址
      const mpBase = ['https:/', '/cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3'].join('');
      const modelBase = ['https:/', '/storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'].join('');
      const visionModule = await import(/* @vite-ignore */ mpBase + '/vision_bundle.mjs');
      const vision = await visionModule.FilesetResolver.forVisionTasks(mpBase + '/wasm');
      const faceLandmarker = await visionModule.FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: modelBase, delegate: "GPU" }, runningMode: "VIDEO", numFaces: 1 });
      
      if (!engineRef.current) {
        engineRef.current = createInkEngine(pixiContainer.current, () => eyeCoordsRef.current, videoRef.current, () => setInteractionState('finished'));
      }
      startTracking(faceLandmarker);
      setInteractionState('ready');
    } catch (err) { console.error(err); setInteractionState('init'); }
  };

  const startTracking = (faceLandmarker) => {
    let lastVideoTime = -1;
    const loop = () => {
      if (videoRef.current && videoRef.current.currentTime !== lastVideoTime) {
        lastVideoTime = videoRef.current.currentTime;
        const results = faceLandmarker.detectForVideo(videoRef.current, performance.now());
        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const marks = results.faceLandmarks[0];
          const vw = videoRef.current.videoWidth; const vh = videoRef.current.videoHeight;
          const scale = Math.min(400 / vw, MONITOR_H / vh);
          const mapPoint = (mark) => {
             const screenX = 200 - ((mark.x * vw - vw/2) * scale);
             const screenY = (MONITOR_H/2) + ((mark.y * vh - vh/2) * scale);
             return { x: screenX, y: screenY };
          };
          
          // 定義完整的下眼緣點位號碼
          const leftLowerIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133];
          const rightLowerIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263];

          eyeCoordsRef.current = { 
            // 輸出完整的下緣陣列
            leftLowerEdge: leftLowerIndices.map(idx => mapPoint(marks[idx])),
            rightLowerEdge: rightLowerIndices.map(idx => mapPoint(marks[idx])),
            // 保留舊的內外側點以防萬一
            leftOuter: mapPoint(marks[33]), 
            leftInner: mapPoint(marks[133]), 
            rightInner: mapPoint(marks[362]), 
            rightOuter: mapPoint(marks[263]) 
          };
        } else { eyeCoordsRef.current = null; }
      }
      requestAnimationFrame(loop);
    };
    loop();
  };

  const toggleWord = (word) => {
    if (selectedWords.includes(word)) {
      setSelectedWords(selectedWords.filter(w => w !== word));
    } else if (selectedWords.length < 5) {
      setSelectedWords([...selectedWords, word]);
    }
  };

  const handleSpawnWord = () => { if (engineRef.current) { setInteractionState('playing'); engineRef.current.spawnWord(selectedWords); } };
  const handleCrying = () => { if (engineRef.current) { setInteractionState('playing'); engineRef.current.triggerCryingSequence(selectedWords); } };
  const handleTryAgain = () => { setInteractionState('ready'); setSelectedWords([]); };

  return (
    // ✨ 背景改為極致深邃的黑 #0a0a0c，讓光暈完全凸顯
    <div className="flex flex-col items-center py-6 min-h-screen bg-[#0a0a0c] text-[#E8E4D9] font-sans">
      
      {/* ✨ 高級感標題設計：增加字距 tracking */}
      <div className="mb-6 text-center px-4">
        <h1 className="text-3xl font-extralight mb-1 tracking-[0.4em] text-white">AFTER FALLING</h1>
        <p className="text-[10px] tracking-[0.6em] text-amber-200/50 uppercase">The Alchemy of Tears</p>
      </div>

      <div className="relative rounded-sm shadow-[0_0_50px_rgba(255,255,255,0.05)] border-4 border-[#111315] overflow-hidden bg-[#0a0a0c]" style={{ width: '400px', height: `${TOTAL_H}px` }}>
        <div className="absolute inset-0 flex flex-col pointer-events-none z-0">
          <div style={{ height: `${MONITOR_H}px` }} className="w-full bg-[#111315]"></div> 
          <div style={{ height: `${GAP_H}px` }} className="w-full bg-[#1A1C20]"></div>     
          <div style={{ height: `${TABLET_H}px` }} className="w-full bg-[#0a0a0c]"></div> 
        </div>

        <video ref={videoRef} playsInline muted autoPlay style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }} />
        <div ref={pixiContainer} className="absolute inset-0 z-10" />

        <div className="absolute left-0 w-full flex justify-center pointer-events-none z-20" style={{ top: `${TABLET_START_Y + 20}px` }}>
          <div className={`pointer-events-auto transition-all duration-1000 ${interactionState === 'playing' ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
            
            {interactionState === 'init' && (
              <div className="flex flex-col items-center gap-4 bg-white/5 backdrop-blur-xl border border-white/10 px-10 py-8 rounded-3xl shadow-2xl w-[340px]">
                <button onClick={initCameraAndAI} className="w-full px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full font-light shadow-lg text-white text-lg tracking-widest transition-all active:scale-95">啟動鏡頭與 AI</button>
              </div>
            )}
            
            {interactionState === 'ready' && (
              // ✨ 玻璃擬態 (Glassmorphism) 選單
              <div className="flex flex-col items-center gap-4 bg-white/5 backdrop-blur-xl border border-white/10 px-6 py-6 rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] w-[360px]">
                <p className="text-gray-300 text-[11px] font-light tracking-[0.2em] mb-1 opacity-70">
                  請選擇 5 個心理狀態 ({selectedWords.length}/5)
                </p>
                
                <div className="grid grid-cols-4 gap-2 w-full">
                  {WORDS.map(word => (
                    <button
                      key={word}
                      onClick={() => toggleWord(word)}
                      className={`py-1 text-[10px] rounded-full transition-all duration-300 ${
                        selectedWords.includes(word) 
                        ? 'bg-blue-500/80 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)] border border-blue-300' 
                        : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {word}
                    </button>
                  ))}
                </div>

                {selectedWords.length === 5 && (
                  <div className="flex gap-2 w-full mt-2 animate-in fade-in slide-in-from-bottom-2">
                    <button onClick={handleSpawnWord} className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/20 rounded-full text-white/80 text-xs tracking-wider transition-transform active:scale-95">單一淚滴</button>
                    <button onClick={handleCrying} className="flex-1 py-2 bg-gradient-to-r from-amber-600/80 to-red-600/80 border border-red-400/50 hover:opacity-90 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.4)] text-white text-xs font-light tracking-wider transition-transform active:scale-95">情緒宣洩</button>
                  </div>
                )}
              </div>
            )}

            {interactionState === 'finished' && (
              <div className="flex flex-col items-center gap-4 bg-white/5 backdrop-blur-xl border border-white/10 px-10 py-8 rounded-3xl shadow-2xl w-[300px]">
                <p className="text-gray-300 text-sm font-light tracking-[0.2em]">情緒已結晶</p>
                <button onClick={handleTryAgain} className="w-full px-10 py-3 bg-white/10 hover:bg-white/20 border border-white/30 rounded-full font-light shadow-lg text-white tracking-widest text-lg transition-transform active:scale-95">再次體驗</button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}