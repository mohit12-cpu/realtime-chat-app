// Connect to the Socket.IO server
const socket = io();

// DOM elements
const joinContainer = document.getElementById('join-container');
const chatContainer = document.getElementById('chat-container');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const errorMessage = document.getElementById('error-message');
const leaveBtn = document.getElementById('leave-btn');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');
const usersList = document.getElementById('users-list');
const userCount = document.getElementById('user-count');
const typingIndicator = document.getElementById('typing-indicator');

let currentUsername = '';
let typingTimeout;

// Join chat functionality
joinBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  if (username) {
    socket.emit('joinUser', username);
  }
});

usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinBtn.click();
  }
});

// Handle successful join
socket.on('welcome', (username) => {
  currentUsername = username;
  joinContainer.style.display = 'none';
  chatContainer.style.display = 'flex';
  messageInput.focus();
});

// Handle username taken
socket.on('usernameTaken', () => {
  errorMessage.textContent = 'Username is already taken. Please choose another one.';
});

// Handle user joined notification
socket.on('userJoined', (username) => {
  addNotification(`${username} joined the chat`);
});

// Handle user left notification
socket.on('userLeft', (username) => {
  addNotification(`${username} left the chat`);
});

// Update users list
socket.on('updateUsers', (users) => {
  usersList.innerHTML = '';
  userCount.textContent = users.length;
  users.forEach(username => {
    const li = document.createElement('li');
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar';
    avatar.textContent = username.charAt(0).toUpperCase();
    li.appendChild(avatar);
    li.appendChild(document.createTextNode(username));

    // Add call button for other users
    if (username !== currentUsername) {
      const callBtn = document.createElement('button');
      callBtn.className = 'call-btn';
      callBtn.textContent = '📞';
      callBtn.title = `Call ${username}`;
      callBtn.addEventListener('click', () => startVideoCall(username));
      li.appendChild(callBtn);
    }

    usersList.appendChild(li);
  });
});

// Send message functionality
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

function sendMessage() {
  const message = messageInput.value.trim();
  if (message) {
    socket.emit('chatMessage', { message });
    messageInput.value = '';
    socket.emit('stopTyping'); // Stop typing when message is sent
  }
}

// Receive new message
socket.on('newMessage', (data) => {
  addMessage(data.username, data.message, data.timestamp, data.username === currentUsername);
  playMessageSound(); // Bonus: sound notification
});

// Add message to chat
function addMessage(username, message, timestamp, isOwn) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isOwn ? 'own' : 'other'}`;

  const infoDiv = document.createElement('div');
  infoDiv.className = 'message-info';
  infoDiv.textContent = `${username} • ${timestamp}`;

  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'message-bubble';
  bubbleDiv.textContent = message;

  messageDiv.appendChild(infoDiv);
  messageDiv.appendChild(bubbleDiv);

  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Add notification (user joined/left)
function addNotification(text) {
  const notificationDiv = document.createElement('div');
  notificationDiv.className = 'message';
  notificationDiv.style.justifyContent = 'center';

  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'message-bubble';
  bubbleDiv.style.backgroundColor = '#f0f0f0';
  bubbleDiv.style.color = '#666';
  bubbleDiv.style.fontStyle = 'italic';
  bubbleDiv.textContent = text;

  notificationDiv.appendChild(bubbleDiv);
  chatMessages.appendChild(notificationDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Typing indicator functionality
messageInput.addEventListener('input', () => {
  if (messageInput.value.trim()) {
    socket.emit('userTyping');
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit('stopTyping');
    }, 1000);
  } else {
    socket.emit('stopTyping');
  }
});

messageInput.addEventListener('blur', () => {
  socket.emit('stopTyping');
});

// Handle typing indicator from other users
socket.on('userTyping', (username) => {
  typingIndicator.textContent = `${username} is typing...`;
});

socket.on('stopTyping', (username) => {
  typingIndicator.textContent = '';
});

// Leave chat functionality
leaveBtn.addEventListener('click', () => {
  socket.disconnect();
  location.reload(); // Simple way to reset the UI
});

// Bonus: Message sound notification
function playMessageSound() {
  // Create a simple beep sound using Web Audio API
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
  oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);

  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.2);
}