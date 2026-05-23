// server.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);

// 🌐 允許跨網域連接（關鍵設定：確保 iPad 可以透過 Wi-Fi 連進電腦的 IP）
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log(`🔌 裝置已連線，分配到的 Socket ID: ${socket.id}`);

  // 📥 1. 接收來自平板的「開始大哭宣洩」指令，立刻轉發給大螢幕顯示器
  socket.on('tablet-trigger-crying', (selectedWords) => {
    console.log('📢 平板發出大哭指令，正在轉發給顯示器。所選詞彙:', selectedWords);
    io.emit('monitor-start-crying', selectedWords);
  });

  // 📥 2. 接收來自顯示器的「眼淚下落越界」座標，立刻轉發給平板激起水波
  socket.on('monitor-tear-overflow', (data) => {
    // data 包含字元的物理資訊，例如 { x: drop.sprite.x, z: drop.z }
    io.emit('tablet-receive-tear', data);
  });

  // 📥 3. 接收來自顯示器的「所有文字掉落完畢」訊號，通知平板切換到結算畫面
  socket.on('monitor-animation-finished', () => {
    console.log('💎 顯示器掉落動畫已完全結束，通知平板顯示寶石結晶結算面。');
    io.emit('tablet-show-finished');
  });

  // 📥 4. 處理裝置斷線
  socket.on('disconnect', () => {
    console.log(`❌ 裝置已中斷連線: ${socket.id}`);
  });

  socket.on('tablet-wake-up', () => socket.broadcast.emit('tablet-wake-up'));
  socket.on('tablet-sleep', () => socket.broadcast.emit('tablet-sleep'));
  socket.on('tablet-settlement', () => socket.broadcast.emit('tablet-settlement'));
});

// 🚀 讓伺服器監聽 3000 連接埠
// '0.0.0.0' 代表允許外部實體裝置（如 iPad）透過區域網路 IP 連進來
server.listen(3000, '0.0.0.0', () => {
  console.log('\n==================================================');
  console.log('🚀 心理共感展場中央通訊伺服器已成功啟動！');
  console.log('📬 正在 port 3000 持續監聽雙螢幕的通訊訊號...');
  console.log('==================================================\n');
});