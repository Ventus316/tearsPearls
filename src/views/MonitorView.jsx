// src/views/MonitorView.jsx
import React, { useEffect, useRef, useState } from 'react';
import { MONITOR_H } from '../config/constants';
import { createInkEngine } from '../engine/0.10.0SakuraInkEngine'; 

export default function MonitorView() {
  const pixiContainer = useRef(null); 
  const videoRef = useRef(null);      
  const engineRef = useRef(null);     
  const eyeCoordsRef = useRef(null);  
  
  const [isReady, setIsReady] = useState(false);

  // 啟動鏡頭與 AI (顯示器端需要人員先點擊一次以獲取瀏覽器攝影機權限)
  const initCameraAndAI = async () => {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise((resolve) => { videoRef.current.onloadedmetadata = () => { videoRef.current.play(); resolve(); }; });
      }
    } catch (err) { alert("顯示器需要相機權限！"); return; }

    try {
      const mpBase = ['https:/', '/cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3'].join('');
      const modelBase = ['https:/', '/storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'].join('');
      const visionModule = await import(/* @vite-ignore */ mpBase + '/vision_bundle.mjs');
      const vision = await visionModule.FilesetResolver.forVisionTasks(mpBase + '/wasm');
      const faceLandmarker = await visionModule.FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: modelBase, delegate: "GPU" }, runningMode: "VIDEO", numFaces: 1 });
      
      // ⚠️ 註：目前暫時先掛載舊的合併版引擎，後續步驟會把它拆乾淨
      if (!engineRef.current) {
        engineRef.current = createInkEngine(pixiContainer.current, () => eyeCoordsRef.current, videoRef.current, () => {});
      }
      
      startTracking(faceLandmarker);
      setIsReady(true);
    } catch (err) { console.error(err); }
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
          const mapPoint = (mark) => ({
             x: 200 - ((mark.x * vw - vw/2) * scale),
             y: (MONITOR_H/2) + ((mark.y * vh - vh/2) * scale)
          });
          const leftLowerIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133];
          const rightLowerIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263];
          eyeCoordsRef.current = { 
            leftLowerEdge: leftLowerIndices.map(idx => mapPoint(marks[idx])),
            rightLowerEdge: rightLowerIndices.map(idx => mapPoint(marks[idx])),
            leftOuter: mapPoint(marks[33]), leftInner: mapPoint(marks[133]), 
            rightInner: mapPoint(marks[362]), rightOuter: mapPoint(marks[263]) 
          };
        } else { eyeCoordsRef.current = null; }
      }
      requestAnimationFrame(loop);
    };
    loop();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#050507]">
      <div className="relative shadow-2xl border border-[#222] bg-black overflow-hidden" style={{ width: '400px', height: `${MONITOR_H}px` }}>
        <video ref={videoRef} playsInline muted autoPlay className="hidden" />
        <div ref={pixiContainer} className="absolute inset-0 z-10" />
        
        {/* 開機按鈕 (隱藏在螢幕中，佈展人員用) */}
        {!isReady && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80">
            <button onClick={initCameraAndAI} className="px-6 py-2 border border-white/20 text-white rounded-md tracking-widest text-sm hover:bg-white/10">
              [系統啟動] 啟動顯示器鏡頭
            </button>
          </div>
        )}
      </div>
    </div>
  );
}