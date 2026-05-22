// src/views/MonitorView.jsx
import React, { useEffect, useRef, useState } from 'react';
import { createMonitorEngine } from '../engine/MonitorEngine'; 
import { io } from 'socket.io-client';

export default function MonitorView() {
  const pixiContainer = useRef(null); const videoRef = useRef(null); const engineRef = useRef(null); const eyeCoordsRef = useRef(null); const socketRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    socketRef.current = io('http://192.168.138.1:3000');
    socketRef.current.on('monitor-start-crying', (selectedWords) => {
      if (engineRef.current) engineRef.current.triggerCrying(selectedWords);
    });
    return () => { 
      if (socketRef.current) socketRef.current.disconnect(); 
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  const initCameraAndAI = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) { videoRef.current.srcObject = stream; await new Promise(r => { videoRef.current.onloadedmetadata = () => { videoRef.current.play(); r(); }; }); }
    } catch (err) { alert("顯示器需要相機權限！"); return; }
    try {
      const mpBase = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3';
      const modelBase = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
      const visionModule = await import(/* @vite-ignore */ mpBase + '/vision_bundle.mjs');
      const vision = await visionModule.FilesetResolver.forVisionTasks(mpBase + '/wasm');
      const faceLandmarker = await visionModule.FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: modelBase, delegate: "GPU" }, runningMode: "VIDEO", numFaces: 1 });
      
      if (!engineRef.current && socketRef.current) engineRef.current = createMonitorEngine(pixiContainer.current, () => eyeCoordsRef.current, videoRef.current, socketRef.current);
      startTracking(faceLandmarker); setIsReady(true);
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
          const sw = window.innerWidth; const sh = window.innerHeight;
          // 🌟 全螢幕滿版縮放的座標對位法
          const scale = Math.max(sw / vw, sh / vh); 
          const mapPoint = (mark) => ({
             x: (sw / 2) - ((mark.x * vw - vw/2) * scale),
             y: (sh / 2) + ((mark.y * vh - vh/2) * scale)
          });
          const leftLowerIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133];
          const rightLowerIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263];
          eyeCoordsRef.current = { 
            leftLowerEdge: leftLowerIndices.map(idx => mapPoint(marks[idx])), rightLowerEdge: rightLowerIndices.map(idx => mapPoint(marks[idx])),
            leftOuter: mapPoint(marks[33]), leftInner: mapPoint(marks[133]), rightInner: mapPoint(marks[362]), rightOuter: mapPoint(marks[263]) 
          };
        } else { eyeCoordsRef.current = null; }
      }
      requestAnimationFrame(loop);
    };
    loop();
  };

  return (
    // 🌟 拔除所有寬高限制，改為 w-screen h-screen
    <div className="w-screen h-screen bg-[#050507] overflow-hidden relative">
      <video ref={videoRef} playsInline muted autoPlay className="hidden" />
      <div ref={pixiContainer} className="absolute inset-0 z-10" />
      
      {!isReady && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80">
          <button onClick={initCameraAndAI} className="px-8 py-3 border border-white/20 text-white rounded-md tracking-widest text-lg hover:bg-white/10 transition-colors">
            [系統開機] 進入全螢幕追蹤模式
          </button>
        </div>
      )}
    </div>
  );
}