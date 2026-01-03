const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the public directory
app.use(express.static('public'));

// Store connected users
let users = [];

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle user joining
  socket.on('joinUser', (username) => {
    // Check if username is already taken
    if (users.find(user => user.username === username)) {
      socket.emit('usernameTaken');
      return;
    }

    // Add user to the list
    const user = { id: socket.id, username };
    users.push(user);

    // Join the user to a room (optional, for future private messaging)
    socket.join('chatroom');

    // Broadcast to all clients that a new user joined
    socket.broadcast.emit('userJoined', username);

    // Send the updated users list to all clients
    io.emit('updateUsers', users.map(u => u.username));

    // Send welcome message to the new user
    socket.emit('welcome', username);
  });

  // Handle chat messages
  socket.on('chatMessage', (data) => {
    const user = users.find(u => u.id === socket.id);
    if (user) {
      const messageData = {
        username: user.username,
        message: data.message,
        timestamp: new Date().toLocaleTimeString()
      };
      // Broadcast the message to all connected clients
      io.emit('newMessage', messageData);
    }
  });

  // Handle typing indicator
  socket.on('userTyping', () => {
    const user = users.find(u => u.id === socket.id);
    if (user) {
      // Broadcast to others that this user is typing
      socket.broadcast.emit('userTyping', user.username);
    }
  });

  // Handle stop typing
  socket.on('stopTyping', () => {
    const user = users.find(u => u.id === socket.id);
    if (user) {
      // Broadcast to others that this user stopped typing
      socket.broadcast.emit('stopTyping', user.username);
    }
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
    const userIndex = users.findIndex(u => u.id === socket.id);
    if (userIndex !== -1) {
      const user = users[userIndex];
      users.splice(userIndex, 1);

      // Broadcast to all clients that a user left
      socket.broadcast.emit('userLeft', user.username);

      // Send the updated users list to all clients
      io.emit('updateUsers', users.map(u => u.username));
    }
  });

  // Video calling signaling events
  // Initiate a call to another user
  socket.on('callUser', (data) => {
    const caller = users.find(u => u.id === socket.id);
    const callee = users.find(u => u.username === data.to);
    if (caller && callee) {
      // Notify the callee about the incoming call
      io.to(callee.id).emit('incomingCall', {
        from: caller.username,
        fromId: caller.id
      });
    }
  });

  // Accept an incoming call
  socket.on('acceptCall', (data) => {
    const accepter = users.find(u => u.id === socket.id);
    const caller = users.find(u => u.id === data.callerId);
    if (accepter && caller) {
      // Notify the caller that the call was accepted
      io.to(caller.id).emit('callAccepted', {
        from: accepter.username,
        fromId: accepter.id
      });
    }
  });

  // Forward WebRTC offer
  socket.on('webrtcOffer', (data) => {
    const targetUser = users.find(u => u.id === data.to);
    if (targetUser) {
      io.to(targetUser.id).emit('webrtcOffer', {
        offer: data.offer,
        from: socket.id
      });
    }
  });

  // Forward WebRTC answer
  socket.on('webrtcAnswer', (data) => {
    const targetUser = users.find(u => u.id === data.to);
    if (targetUser) {
      io.to(targetUser.id).emit('webrtcAnswer', {
        answer: data.answer,
        from: socket.id
      });
    }
  });

  // Forward ICE candidates
  socket.on('iceCandidate', (data) => {
    const targetUser = users.find(u => u.id === data.to);
    if (targetUser) {
      io.to(targetUser.id).emit('iceCandidate', {
        candidate: data.candidate,
        from: socket.id
      });
    }
  });

  // Handle end call
  socket.on('endCall', (data) => {
    const targetUser = users.find(u => u.id === data.to);
    if (targetUser) {
      io.to(targetUser.id).emit('callEnded', {
        from: socket.id
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});