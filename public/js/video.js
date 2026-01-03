// Video calling functionality using WebRTC
let localStream;
let peerConnection;
let currentCallUser = null;
let currentCallSocketId = null;
let isInCall = false;

// WebRTC configuration
const rtcConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// DOM elements for video call
const videoCallContainer = document.getElementById('video-call-container');
const remoteVideo = document.getElementById('remote-video');
const localVideo = document.getElementById('local-video');
const callStatus = document.getElementById('call-status');
const muteBtn = document.getElementById('mute-btn');
const cameraBtn = document.getElementById('camera-btn');
const endCallBtn = document.getElementById('end-call-btn');
const incomingCallPopup = document.getElementById('incoming-call-popup');
const callerName = document.getElementById('caller-name');
const acceptCallBtn = document.getElementById('accept-call-btn');
const rejectCallBtn = document.getElementById('reject-call-btn');

// Start video call function (called from chat.js)
function startVideoCall(username) {
  if (isInCall) {
    alert('You are already in a call!');
    return;
  }

  currentCallUser = username;
  // Note: We'll get the socket ID from the server response
  callStatus.textContent = `Calling ${username}...`;

  // Request camera and microphone access
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      localStream = stream;
      localVideo.srcObject = stream;

      // Create peer connection
      createPeerConnection();

      // Add local stream to peer connection
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });

      // Send call request to the other user
      socket.emit('callUser', { to: username });

      // Show video call interface
      showVideoCallInterface();
    })
    .catch(error => {
      console.error('Error accessing media devices:', error);
      alert('Could not access camera and microphone. Please check permissions.');
    });
}

// Create WebRTC peer connection
function createPeerConnection() {
  peerConnection = new RTCPeerConnection(rtcConfiguration);

  // Handle remote stream
  peerConnection.ontrack = event => {
    if (event.streams && event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
    }
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = event => {
    if (event.candidate && currentCallSocketId) {
      socket.emit('iceCandidate', {
        to: currentCallSocketId,
        candidate: event.candidate
      });
    }
  };

  // Handle connection state changes
  peerConnection.onconnectionstatechange = () => {
    if (peerConnection.connectionState === 'connected') {
      callStatus.textContent = `In call with ${currentCallUser}`;
      isInCall = true;
    }
  };
}

// Get socket ID by username (helper function)
function getSocketIdByUsername(username) {
  // This would need to be implemented to map username to socket ID
  // For now, we'll handle this in the signaling events
  return null; // Will be handled by server-side user management
}

// Show video call interface
function showVideoCallInterface() {
  videoCallContainer.style.display = 'flex';
  chatContainer.style.display = 'none';
}

// Hide video call interface
function hideVideoCallInterface() {
  videoCallContainer.style.display = 'none';
  chatContainer.style.display = 'flex';
}

// Socket.IO signaling event handlers

// Handle incoming call
socket.on('incomingCall', (data) => {
  if (isInCall) {
    // Reject call if already in one
    socket.emit('endCall', { to: data.fromId });
    return;
  }

  currentCallUser = data.from;
  currentCallSocketId = data.fromId;
  callerName.textContent = `${data.from} is calling...`;
  incomingCallPopup.style.display = 'flex';
});

// Handle call accepted
socket.on('callAccepted', (data) => {
  currentCallSocketId = data.fromId;
  callStatus.textContent = `Connecting to ${data.from}...`;
  // Create offer and send it
  peerConnection.createOffer()
    .then(offer => {
      return peerConnection.setLocalDescription(offer);
    })
    .then(() => {
      socket.emit('webrtcOffer', {
        to: currentCallSocketId,
        offer: peerConnection.localDescription
      });
    })
    .catch(error => {
      console.error('Error creating offer:', error);
    });
});

// Handle WebRTC offer
socket.on('webrtcOffer', (data) => {
  // Set remote description
  peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
    .then(() => {
      // Create answer
      return peerConnection.createAnswer();
    })
    .then(answer => {
      return peerConnection.setLocalDescription(answer);
    })
    .then(() => {
      // Send answer back
      socket.emit('webrtcAnswer', {
        to: data.from,
        answer: peerConnection.localDescription
      });
    })
    .catch(error => {
      console.error('Error handling offer:', error);
    });
});

// Handle WebRTC answer
socket.on('webrtcAnswer', (data) => {
  peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
    .catch(error => {
      console.error('Error setting remote description:', error);
    });
});

// Handle ICE candidates
socket.on('iceCandidate', (data) => {
  if (peerConnection && data.candidate) {
    peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
      .catch(error => {
        console.error('Error adding ICE candidate:', error);
      });
  }
});

// Handle call ended
socket.on('callEnded', () => {
  endCall();
});

// Call control event listeners

// Accept incoming call
acceptCallBtn.addEventListener('click', () => {
  incomingCallPopup.style.display = 'none';

  // Request media access
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      localStream = stream;
      localVideo.srcObject = stream;

      // Create peer connection
      createPeerConnection();

      // Add local stream
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });

      // Notify caller that call was accepted
      socket.emit('acceptCall', { callerId: currentCallSocketId });

      // Show video interface
      showVideoCallInterface();
    })
    .catch(error => {
      console.error('Error accessing media devices:', error);
      alert('Could not access camera and microphone.');
    });
});

// Reject incoming call
rejectCallBtn.addEventListener('click', () => {
  incomingCallPopup.style.display = 'none';
  socket.emit('endCall', { to: currentCallSocketId });
  currentCallUser = null;
  currentCallSocketId = null;
});

// Mute/unmute microphone
muteBtn.addEventListener('click', () => {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      muteBtn.classList.toggle('muted');
      document.getElementById('mute-icon').textContent = audioTrack.enabled ? '🔊' : '🔇';
      muteBtn.innerHTML = `<span id="mute-icon">${audioTrack.enabled ? '🔊' : '🔇'}</span> ${audioTrack.enabled ? 'Mute' : 'Unmute'}`;
    }
  }
});

// Toggle camera
cameraBtn.addEventListener('click', () => {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      cameraBtn.classList.toggle('camera-off');
      document.getElementById('camera-icon').textContent = videoTrack.enabled ? '📹' : '📷';
      cameraBtn.innerHTML = `<span id="camera-icon">${videoTrack.enabled ? '📹' : '📷'}</span> ${videoTrack.enabled ? 'Camera' : 'Camera Off'}`;
    }
  }
});

// End call
endCallBtn.addEventListener('click', () => {
  endCall();
});

// End call function
function endCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  remoteVideo.srcObject = null;
  localVideo.srcObject = null;

  if (currentCallSocketId) {
    socket.emit('endCall', { to: currentCallSocketId });
  }

  hideVideoCallInterface();
  isInCall = false;
  currentCallUser = null;
  currentCallSocketId = null;
}

// Handle page unload (end call if in one)
window.addEventListener('beforeunload', () => {
  if (isInCall) {
    endCall();
  }
});