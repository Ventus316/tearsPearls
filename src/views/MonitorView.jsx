// src/views/MonitorView.jsx
import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Howl } from 'howler';

import { createMonitorEngine } from '../engine/MonitorEngine'; 
import waitImage from '../assets/wait_monitor.jpg';
import { STANDBY_WIND_FREQUENCY, STANDBY_WIND_SCALE_VALUES, STANDBY_WIND_DURATION, SERVER_IP, AUDIO_POOL } from '../config/constants';

/**
 * 展場大螢幕視圖 (Monitor View)
 * 負責處理：相機授權、MediaPipe 臉部特徵點偵測、Socket 訊號接收與待機圖層切換。
 */
export default function MonitorView() {
  const pixiContainer = useRef(null); 
  const videoRef = useRef(null);
  const processedCanvasRef = useRef(null);  //去背画布
  const engineRef = useRef(null); 
  const eyeCoordsRef = useRef(null); 
  const socketRef = useRef(null);
  
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isStandby, setIsStandby] = useState(true); 

  useEffect(() => {
    socketRef.current = io(SERVER_IP);
    
    // ==========================================
    // 🎵 動態初始化隨機音效池 (Howler.js)
    // ==========================================
    const soundInstances = {};
    
    // 🌟 根據 constants.js 的陣列，自動載入所有音檔
    AUDIO_POOL.forEach(fileName => {
      soundInstances[fileName] = new Howl({ 
        src: [`/audio/${fileName}`], 
        html5: false, 
        volume: 0.8 // 統一設定展場預設音量
      });
    });

    // 🎵 監聽平板傳來的播放訊號
    socketRef.current.on('monitor-play-sound', (soundFileName) => {
      if (soundInstances[soundFileName]) {
        soundInstances[soundFileName].play();
      }
    });

    socketRef.current.on('monitor-start-crying', (words) => {
      if (engineRef.current) {
        engineRef.current.triggerCrying(words);
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
        await new Promise(r => { 
          if (!videoRef.current) return r(); 
          videoRef.current.onloadedmetadata = () => { 
            videoRef.current?.play(); 
            r(); 
          }; 
        }); 
      }
    } catch (err) { 
      alert("無法存取相機，請檢查瀏覽器權限設定！"); 
      return; 
    }
    
    try {
      setIsCameraOn(true); 

      const mpBase = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3';
      const faceModel = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
      const segmenterModel = '/models/selfie_segmenter.tflite';

      const visionModule = await import(/* @vite-ignore */ mpBase + '/vision_bundle.mjs');
      const vision = await visionModule.FilesetResolver.forVisionTasks(mpBase + '/wasm');
      
      const faceLandmarker = await visionModule.FaceLandmarker.createFromOptions(vision, { 
        baseOptions: { modelAssetPath: faceModel, delegate: "GPU" }, 
        runningMode: "VIDEO", 
        // 🌟 修正 1：降回 2 人。5 人太耗效能會造成掉幀，2 人足以辨識「前面的人與背景的人」
        numFaces: 2,
        minFaceDetectionConfidence: 0.4,
        minFacePresenceConfidence: 0.4,
        minTrackingConfidence: 0.4
      });

      const imageSegmenter = await visionModule.ImageSegmenter.createFromOptions(vision, {
        baseOptions: { modelAssetPath: segmenterModel, delegate: "GPU" },
        runningMode: "VIDEO",
        outputCategoryMask: true,
      });

      if (!engineRef.current && socketRef.current) {
        engineRef.current = createMonitorEngine(pixiContainer.current, () => eyeCoordsRef.current, processedCanvasRef.current, socketRef.current);
      }
      startTracking(faceLandmarker, imageSegmenter); 
    } catch (err) { 
      console.error("AI 模型載入失敗:", err); 
    }
  };

  const startTracking = (faceLandmarker, imageSegmenter) => {
    let lastVideoTime = -1;
    const leftLowerIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133];
    const rightLowerIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263];

    // 🌟 修正 2：加入「緩衝容錯計數器 (Hysteresis Buffer)」
    let lostFaceFrames = 0; 
    const MAX_LOST_FRAMES = 15; // 容忍 15 幀 (約 0.25 秒) 的遮擋，不立刻切斷眼淚

    const loop = () => {
      if (videoRef.current && videoRef.current.readyState >= 2 && videoRef.current.currentTime !== lastVideoTime) {
        lastVideoTime = videoRef.current.currentTime;
        const nowInMs = performance.now();
        
        const vw = videoRef.current.videoWidth; 
        const vh = videoRef.current.videoHeight;
        const sw = window.innerWidth; 
        const sh = window.innerHeight;
        
        // 🌟 修正 3：嚴格防呆，確保影片長寬大於 0，防止除以 0 產生 NaN 隱形眼淚
        if (vw > 0 && vh > 0) {
          const faceResults = faceLandmarker.detectForVideo(videoRef.current, nowInMs);
          
          if (faceResults.faceLandmarks && faceResults.faceLandmarks.length > 0) {
            let closestFaceIndex = 0;
            let maxFaceWidth = 0;
            
            faceResults.faceLandmarks.forEach((marks, index) => {
              const faceWidth = Math.abs(marks[454].x - marks[234].x);
              if (faceWidth > maxFaceWidth) {
                maxFaceWidth = faceWidth;
                closestFaceIndex = index;
              }
            });

            const marks = faceResults.faceLandmarks[closestFaceIndex];
            const scale = Math.max(sw / vw, sh / vh); 
            const mapPoint = (mark) => ({
               x: (sw / 2) - ((mark.x * vw - vw/2) * scale),
               y: (sh / 2) + ((mark.y * vh - vh/2) * scale)
            });
            
            const testEyePoint = mapPoint(marks[145]);
            
            // 🌟 修正 4：除了防護上下邊界，加入 isNaN 檢查，徹底阻擋錯誤數據
            if (testEyePoint.y < -50 || testEyePoint.y > sh + 50 || isNaN(testEyePoint.x) || isNaN(testEyePoint.y)) {
               lostFaceFrames++; // 數據髒掉，累加丟失計數
            } else {
               lostFaceFrames = 0; // 數據完美，重置計數器
               eyeCoordsRef.current = { 
                leftLowerEdge: leftLowerIndices.map(idx => mapPoint(marks[idx])), 
                rightLowerEdge: rightLowerIndices.map(idx => mapPoint(marks[idx])),
                leftOuter: mapPoint(marks[33]), 
                leftInner: mapPoint(marks[133]), 
                rightInner: mapPoint(marks[362]), 
                rightOuter: mapPoint(marks[263]) 
              };
            }
          } else { 
            lostFaceFrames++; // 完全沒抓到臉，累加丟失計數
          }

          // 🌟 修正 5：只有當「連續」丟失超過 15 幀時，才真正切換回預設的假眼睛
          // 這樣使用者稍微低頭或被手揮過去，眼淚都會保持在原地，不會亂跳！
          if (lostFaceFrames > MAX_LOST_FRAMES) {
             eyeCoordsRef.current = null;
          }

          // ==========================================
          // 影像去背處理 (Image Segmentation)
          // ==========================================
          if (processedCanvasRef.current) {
            const canvas = processedCanvasRef.current;
            const ctx = canvas.getContext('2d', { willReadFrequently: true }); 
            
            if (canvas.width !== vw) { canvas.width = vw; canvas.height = vh; }

            const segResults = imageSegmenter.segmentForVideo(videoRef.current, nowInMs);
            
            if (segResults && segResults.categoryMask) {
              const maskArray = segResults.categoryMask.getAsUint8Array();
              ctx.drawImage(videoRef.current, 0, 0, vw, vh);
              const imageData = ctx.getImageData(0, 0, vw, vh);
              const pixels = imageData.data;
              
              for (let i = 0; i < maskArray.length; i++) {
                // 🌟 修正 1：反轉去背邏輯！
                // 因為上一版 === 0 會讓人變黑，代表這支模型把「人」定義為 0。
                // 所以我們現在只要把「不等於 0 的像素 (!== 0)」(也就是背景) 塗黑即可。
                if (maskArray[i] !== 0) {
                  const offset = i * 4;
                  pixels[offset] = 0;     
                  pixels[offset + 1] = 0; 
                  pixels[offset + 2] = 0; 
                }
              }
              ctx.putImageData(imageData, 0, 0);

              // 🌟 修正 2：【致命錯誤修復】強制釋放 WebAssembly 記憶體！
              // 徹底解決 Console 中的 Memory Leak 警告，確保全天候掛機不崩潰。
              segResults.categoryMask.close();
            }
          }
        }
      }
      requestAnimationFrame(loop);
    };
    loop();
  };

  return (
    <div className="w-screen h-screen bg-[#050507] overflow-hidden relative">
      <video ref={videoRef} playsInline muted autoPlay className="hidden" />
      
      {/* 隐藏画布 */}
      <canvas ref={processedCanvasRef} className="hidden" />

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