// src/views/MonitorView.jsx
import React, { useEffect, useRef, useState } from 'react';
import { createMonitorEngine } from '../engine/MonitorEngine'; 
import { io } from 'socket.io-client';
import waitImage from '../assets/wait_monitor.jpg';

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
  const [isStandby, setIsStandby] = useState(true); // 控制待機圖片層的顯示狀態

  useEffect(() => {
    // 🔌 建立 Socket 連線 (佈展時請確認此 IP 與 Server 啟動的 IP 相同)
    socketRef.current = io('http://192.168.138.1:3000');
    
    // 📥 接收來自平板的「開始流淚」訊號
    socketRef.current.on('monitor-start-crying', (selectedWords) => {
      setIsStandby(false); // 雙重保險：強制隱藏待機圖片
      if (engineRef.current) engineRef.current.triggerCrying(selectedWords);
    });

    // 📥 接收來自平板的待機狀態同步訊號
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

  /**
   * 🎥 初始化相機與 MediaPipe AI 模型
   * 必須由使用者 (工作人員) 手動點擊按鈕觸發，以符合瀏覽器隱私政策。
   */
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
      setIsCameraOn(true); // 成功開啟相機後，隱藏開機按鈕

      // 載入 Google MediaPipe 臉部偵測模型 (WebAssembly)
      const mpBase = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3';
      const modelBase = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
      const visionModule = await import(/* @vite-ignore */ mpBase + '/vision_bundle.mjs');
      const vision = await visionModule.FilesetResolver.forVisionTasks(mpBase + '/wasm');
      const faceLandmarker = await visionModule.FaceLandmarker.createFromOptions(vision, { 
        baseOptions: { modelAssetPath: modelBase, delegate: "GPU" }, 
        runningMode: "VIDEO", 
        numFaces: 1 
      });
      
      // 初始化 PIXI 引擎
      if (!engineRef.current && socketRef.current) {
        engineRef.current = createMonitorEngine(pixiContainer.current, () => eyeCoordsRef.current, videoRef.current, socketRef.current);
      }
      startTracking(faceLandmarker); 
    } catch (err) { 
      console.error("AI 模型載入失敗:", err); 
    }
  };

  /**
   * 👁️ 持續追蹤臉部特徵點並更新座標
   */
  const startTracking = (faceLandmarker) => {
    let lastVideoTime = -1;

    // 定義左右眼下緣的特徵點 Index (用於生成眼淚的起始位置)
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
          
          // 📐 座標轉換核心：計算 Object-Fit: Cover 的縮放比例
          const scale = Math.max(sw / vw, sh / vh); 
          const mapPoint = (mark) => ({
             // X 軸鏡像反轉，並加上置中偏移量
             x: (sw / 2) - ((mark.x * vw - vw/2) * scale),
             // Y 軸等比例縮放加上置中偏移量
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
          eyeCoordsRef.current = null; // 抓不到臉孔時清空座標，交給引擎隨機生成
        }
      }
      requestAnimationFrame(loop);
    };
    loop();
  };

  return (
    <div className="w-screen h-screen bg-[#050507] overflow-hidden relative">
      {/* 隱藏的原始攝影機畫面 (提供給 PIXI 與 AI 模型讀取) */}
      <video ref={videoRef} playsInline muted autoPlay className="hidden" />
      
      {/* 🌟 待機圖片圖層 (透過 isStandby 控制透明度) */}
      <img
        src={waitImage}
        className={`absolute inset-0 w-full h-full object-cover z-30 transition-opacity duration-1000 ${
          isStandby ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        alt="Standby"
      />

      {/* PIXI 物理特效畫布 */}
      <div ref={pixiContainer} className="absolute inset-0 z-10" />
      
      {/* 開機引導畫面：僅在未授權相機前顯示 */}
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