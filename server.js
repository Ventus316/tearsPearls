// server.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);

// 🌐 允許跨網域連接（關鍵設定：確保展場 iPad 可以透過 Wi-Fi 連進主機的 IP）
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log(`🔌 [連線] 裝置已加入，分配 Socket ID: ${socket.id}`);

  // ==========================================
  // 📡 核心互動生命週期 (平板 -> 顯示器)
  // ==========================================
  
  // 1. 接收來自平板的「大哭宣洩」指令，轉發給大螢幕顯示器
  socket.on('tablet-trigger-crying', (selectedWords) => {
    console.log(`📢 [互動] 啟動宣洩程序，傳遞詞彙:`, selectedWords);
    // 💡 優化：使用 broadcast 只發送給另一台裝置，避免發送者自己重複接收
    socket.broadcast.emit('monitor-start-crying', selectedWords);
  });


  // ==========================================
  // 💦 物理特效座標連動 (顯示器 -> 平板)
  // ==========================================
  
  // 2. 顯示器「眼淚下落越界」座標，轉發給平板激起水波
  socket.on('monitor-tear-overflow', (data) => {
    // data 包含字元的物理資訊與字體，例如 { nx, z, char }
    socket.broadcast.emit('tablet-receive-tear', data);
  });

  // 3. 顯示器「文字掉落完畢」訊號，通知平板切換到結算畫面
  socket.on('monitor-animation-finished', () => {
    console.log('💎 [狀態] 大螢幕掉落動畫結束，通知平板啟動結算。');
    socket.broadcast.emit('tablet-show-finished');
  });


  // ==========================================
  // 🛌 展場無人值守待機系統 (跨裝置狀態同步)
  // ==========================================
  
  // 4. 同步雙螢幕的喚醒與睡眠狀態
  socket.on('tablet-wake-up', () => socket.broadcast.emit('tablet-wake-up'));
  socket.on('tablet-sleep', () => socket.broadcast.emit('tablet-sleep'));
  socket.on('tablet-settlement', () => socket.broadcast.emit('tablet-settlement'));


  // ==========================================
  // ❌ 網路中斷處理
  // ==========================================
  socket.on('disconnect', () => {
    console.log(`❌ [斷線] 裝置已中斷連線: ${socket.id}`);
  });
});


// 🚀 啟動伺服器 
// '0.0.0.0' 代表允許外部實體裝置透過區域網路 IPv4 連進來
server.listen(3000, '0.0.0.0', () => {
  console.log('\n==================================================');
  console.log('🚀 AFTER FALLING - 展場中央通訊伺服器已成功啟動！');
  console.log('📬 正在 Port 3000 持續監聽雙螢幕的通訊訊號...');
  console.log('==================================================\n');
});