const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static('public'));

io.on('connection', socket => {
  socket.on('join', ({ room, pseudo }) => {
    socket.join(room);
    socket.to(room).emit('ready');
  });

  socket.on('signal', ({ room, data }) => {
    socket.to(room).emit('signal', { data });
  });
});

server.listen(3000, () => {
  console.log('✅ Serveur WebRTC sur http://localhost:3000');
});
