// server.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);

// 🌐 允許跨網域連接，確保展場裝置可連入
const io = new Server(server, { 
  cors: { origin: "*", methods: ["GET", "POST"] } 
});

io.on('connection', (socket) => {
  console.log(`🔌 [連線] Socket ID: ${socket.id}`);

  // 1. 互動指令：平板發出宣洩訊號，轉發給顯示器
  socket.on('tablet-trigger-crying', (words) => {
    socket.broadcast.emit('monitor-start-crying', words);
  });

  // 2. 物理連動：顯示器眼淚掉落座標，轉發給平板生成水波
  socket.on('monitor-tear-overflow', (data) => {
    socket.broadcast.emit('tablet-receive-tear', data);
  });

  // 3. 狀態切換：顯示器掉落動畫結束，通知平板啟動結算
  socket.on('monitor-animation-finished', () => {
    socket.broadcast.emit('tablet-show-finished');
  });

  // 4. 生命週期：待機 / 喚醒 / 結算狀態同步
  socket.on('tablet-wake-up', () => socket.broadcast.emit('tablet-wake-up'));
  socket.on('tablet-sleep', () => socket.broadcast.emit('tablet-sleep'));
  socket.on('tablet-settlement', () => socket.broadcast.emit('tablet-settlement'));

  // 5. 🔊 音效連動：接收平板的發聲指令，並轉發給顯示器主機
  socket.on('tablet-play-sound', (soundType) => {
    socket.broadcast.emit('monitor-play-sound', soundType);
  });

  // 斷線處理
  socket.on('disconnect', () => {
    console.log(`❌ [斷線] Socket ID: ${socket.id}`);
  });
});

server.listen(3000, '0.0.0.0', () => {
  console.log('🚀 通訊伺服器運行中 (Port 3000)');
});