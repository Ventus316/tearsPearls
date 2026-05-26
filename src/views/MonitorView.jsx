// src/views/MonitorView.jsx
import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Howl } from 'howler';

import { createMonitorEngine } from '../engine/MonitorEngine'; 
import waitImage from '../assets/wait_monitor.jpg';
import { STANDBY_WIND_FREQUENCY, STANDBY_WIND_SCALE_VALUES, STANDBY_WIND_DURATION, SERVER_IP } from '../config/constants';

/**
 * 展場大螢幕視圖 (Monitor View)
 * 負責處理：相機授權、MediaPipe 臉部特徵點偵測、Socket 訊號接收與待機圖層切換。
 */
export default function MonitorView() {
  const pixiContainer = useRef(null); 
  const videoRef = useRef(null); 
  const engineRef = useRef(null); 
  const eyeCoordsRef = useRef(null); 
  const socketRef = useRef(null);
  
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isStandby, setIsStandby] = useState(true); 

  useEffect(() => {
    socketRef.current = io(SERVER_IP);
    
    // ==========================================
    // 🎵 初始化三種層次的水滴音效 (Howler.js)
    // ==========================================
    const dropSmallSound = new Howl({ 
      src: ['/audio/drop_small.mp3'], 
      html5: false, 
      volume: 0.5 // 小水滴降低音量，製造細碎感
    });

    const dropMidSound = new Howl({ 
      src: ['/audio/drop_mid.mp3'], 
      html5: false, 
      volume: 0.8 // 中水滴標準音量
    });

    const dropLargeSound = new Howl({ 
      src: ['/audio/drop_large.mp3'], 
      html5: false, 
      volume: 1.0 // 大水滴全音量輸出，保留重低音共鳴
    });

    // 🎵 監聽平板傳來的播放訊號
    socketRef.current.on('monitor-play-sound', (soundType) => {
      if (soundType === 'drop_small') dropSmallSound.play();
      else if (soundType === 'drop_mid') dropMidSound.play();
      else if (soundType === 'drop_large') dropLargeSound.play();
    });

    socketRef.current.on('monitor-start-crying', (selectedWords) => {
      if (engineRef.current) {
        engineRef.current.triggerCrying(selectedWords);
      }
    });

    socketRef.current.on('tablet-wake-up', () => setIsStandby(false));
    socketRef.current.on('tablet-sleep', () => setIsStandby(true));
    socketRef.current.on('tablet-settlement', () => setIsStandby(true));

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
      if (videoRef.current) { 
        videoRef.current.srcObject = stream; 
        await new Promise(r => { videoRef.current.onloadedmetadata = () => { videoRef.current.play(); r(); }; }); 
      }
    } catch (err) { 
      alert("無法存取相機，請檢查瀏覽器權限設定！"); 
      return; 
    }
    
    try {
      setIsCameraOn(true); 

      const mpBase = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3';
      const modelBase = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
      const visionModule = await import(/* @vite-ignore */ mpBase + '/vision_bundle.mjs');
      const vision = await visionModule.FilesetResolver.forVisionTasks(mpBase + '/wasm');
      const faceLandmarker = await visionModule.FaceLandmarker.createFromOptions(vision, { 
        baseOptions: { modelAssetPath: modelBase, delegate: "GPU" }, 
        runningMode: "VIDEO", 
        numFaces: 1 
      });
      
      if (!engineRef.current && socketRef.current) {
        engineRef.current = createMonitorEngine(pixiContainer.current, () => eyeCoordsRef.current, videoRef.current, socketRef.current);
      }
      startTracking(faceLandmarker); 
    } catch (err) { 
      console.error("AI 模型載入失敗:", err); 
    }
  };

  const startTracking = (faceLandmarker) => {
    let lastVideoTime = -1;

    const leftLowerIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133];
    const rightLowerIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263];

    const loop = () => {
      if (videoRef.current && videoRef.current.currentTime !== lastVideoTime) {
        lastVideoTime = videoRef.current.currentTime;
        const results = faceLandmarker.detectForVideo(videoRef.current, performance.now());
        
        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const marks = results.faceLandmarks[0];
          const vw = videoRef.current.videoWidth; 
          const vh = videoRef.current.videoHeight;
          const sw = window.innerWidth; 
          const sh = window.innerHeight;
          
          const scale = Math.max(sw / vw, sh / vh); 
          const mapPoint = (mark) => ({
             x: (sw / 2) - ((mark.x * vw - vw/2) * scale),
             y: (sh / 2) + ((mark.y * vh - vh/2) * scale)
          });
          
          eyeCoordsRef.current = { 
            leftLowerEdge: leftLowerIndices.map(idx => mapPoint(marks[idx])), 
            rightLowerEdge: rightLowerIndices.map(idx => mapPoint(marks[idx])),
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
    <div className="w-screen h-screen bg-[#050507] overflow-hidden relative">
      <video ref={videoRef} playsInline muted autoPlay className="hidden" />
      
      {/* 🌟 畫布呼吸風動濾鏡 (SVG Displacement Map) */}
      {/* 隱藏在背景，專門提供 UV 偏移數學運算給待機圖片使用 */}
      <svg width="0" height="0" className="absolute pointer-events-none">
        <filter id="canvas-wind" x="-20%" y="-20%" width="140%" height="140%">
          {/* 🌟 1. 綁定波動頻率 (baseFrequency) */}
          <feTurbulence type="fractalNoise" baseFrequency={STANDBY_WIND_FREQUENCY} numOctaves="1" result="noise" />
          
          {/* 🌟 2. 綁定波動強度 (values) 與 呼吸循環時間 (dur) */}
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G">
            <animate attributeName="scale" values={STANDBY_WIND_SCALE_VALUES} dur={STANDBY_WIND_DURATION} repeatCount="indefinite" />
          </feDisplacementMap>
        </filter>
      </svg>

      {/* 🌟 大螢幕待機圖片層 (套用 UV 偏移濾鏡) */}
      <img
        src={waitImage}
        style={{
          filter: 'url(#canvas-wind)',
          transform: 'scale(1.05)' // 💡 稍微放大 5%，避免 UV 偏移時邊緣拉扯露出背後的黑邊
        }}
        className={`absolute inset-0 w-full h-full object-cover z-30 transition-opacity duration-1000 ${
          isStandby ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        alt="Standby"
      />

      <div ref={pixiContainer} className="absolute inset-0 z-10" />
      
      {!isCameraOn && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
          <button 
            onClick={initCameraAndAI} 
            className="px-8 py-3 border border-white/20 text-white rounded-md tracking-widest text-lg hover:bg-white/10 transition-colors pointer-events-auto"
          >
            [系統開機] 進入全螢幕追蹤模式
          </button>
        </div>
      )}
    </div>
  );
}