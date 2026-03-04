// --- src/call/callUI.js ---

function showIncomingCallModal(callerName, callType) {
    try {
        const modal = document.getElementById('incoming-call-modal');
        if (!modal) return;

        const nameEl = document.getElementById('incoming-caller-name');
        if (nameEl) nameEl.textContent = callerName;

        const typeEl = document.getElementById('incoming-call-type');
        if (typeEl) typeEl.textContent = callType === 'video' ? 'Video Incoming Call...' : 'Audio Incoming Call...';

        const iconEl = document.getElementById('accept-call-icon');
        if (iconEl) iconEl.className = callType === 'video' ? 'fas fa-video' : 'fas fa-phone';

        const avatarEl = document.getElementById('call-avatar-ring');
        if (avatarEl) avatarEl.textContent = callerName ? callerName.charAt(0).toUpperCase() : '?';

        modal.classList.remove('hidden');
        if (window.startRing) window.startRing();

        // Show browser notification for the call
        if (window.showCallNotification) window.showCallNotification(callerName, callType, '');
    } catch (e) {
        console.warn("Failed to show incoming call modal UI:", e);
    }
}

function showActiveCallWindow(peerName, callType) {
    const win = document.getElementById('active-call-window');
    win.classList.remove('hidden');

    // Name badge on center screen
    const nameBadge = document.getElementById('call-peer-name');
    if (nameBadge) nameBadge.textContent = peerName;

    // Sidebar list name
    const sideName = document.getElementById('call-peer-name-side');
    if (sideName) sideName.textContent = peerName;

    const typeLabel = document.getElementById('call-type-label');
    if (typeLabel) typeLabel.textContent = callType === 'video' ? 'Video Call' : 'Audio Call';

    // Avatars
    const initial = peerName.charAt(0).toUpperCase();
    const sideAvatar = document.getElementById('call-peer-avatar-list');
    if (sideAvatar) sideAvatar.textContent = initial;

    const bigAvatar = document.getElementById('audio-peer-avatar-big');
    if (bigAvatar) bigAvatar.textContent = initial;

    const audioNameBig = document.getElementById('audio-peer-name-big');
    if (audioNameBig) audioNameBig.textContent = peerName;

    const audioPlaceholder = document.getElementById('audio-call-placeholder');
    const localContainer = document.getElementById('local-video-container');
    const remoteVideo = document.getElementById('remote-video');
    const localVideo = document.getElementById('local-video');

    if (callType === 'audio') {
        remoteVideo.classList.add('opacity-0');
        if (localContainer) localContainer.classList.add('hidden');
        audioPlaceholder.classList.remove('hidden');
        audioPlaceholder.style.display = 'flex';
    } else {
        remoteVideo.classList.remove('opacity-0');
        if (localContainer) localContainer.classList.remove('hidden');
        audioPlaceholder.classList.add('hidden');
        if (window.localStream) localVideo.srcObject = window.localStream;
    }
}

function toggleMute() {
    if (!window.localStream) return;
    const audioTracks = window.localStream.getAudioTracks();
    if (!audioTracks.length) return;

    // Toggle the first track, then sync the others to match
    const newState = !audioTracks[0].enabled;
    audioTracks.forEach(t => t.enabled = newState);

    const btn = document.getElementById('btn-mute');
    const sideMic = document.querySelector('#call-left-sidebar .fa-microphone, #call-left-sidebar .fa-microphone-slash');

    if (newState) {
        btn.innerHTML = '<i class="fas fa-microphone text-lg group-hover:scale-110 transition-transform"></i>';
        btn.style.color = 'white';
        if (sideMic) { sideMic.className = 'fas fa-microphone text-[10px] text-emerald-400'; }
    } else {
        btn.innerHTML = '<i class="fas fa-microphone-slash text-lg group-hover:scale-110 transition-transform"></i>';
        btn.style.color = '#ef4444'; // red-500
        if (sideMic) { sideMic.className = 'fas fa-microphone-slash text-[10px] text-red-500'; }
    }
}

function toggleCamera() {
    if (!window.localStream) return;
    const videoTracks = window.localStream.getVideoTracks();
    if (!videoTracks.length) return;

    // Toggle the first track, then sync the others to match
    const newState = !videoTracks[0].enabled;
    videoTracks.forEach(t => t.enabled = newState);

    const btn = document.getElementById('btn-camera');

    if (newState) {
        btn.innerHTML = '<i class="fas fa-video text-lg group-hover:scale-110 transition-transform"></i>';
        btn.style.color = 'white';
    } else {
        btn.innerHTML = '<i class="fas fa-video-slash text-lg group-hover:scale-110 transition-transform"></i>';
        btn.style.color = '#ef4444'; // red-500
    }
}

let screenStream = null;
async function toggleScreenShare() {
    const btn = document.getElementById('btn-screen');

    if (screenStream) {
        // Stop sharing
        screenStream.getTracks().forEach(t => t.stop());
        screenStream = null;

        // Revert to camera
        const videoTrack = window.localStream.getVideoTracks()[0];
        if (videoTrack) {
            Object.values(window.peerConnections).forEach(pc => {
                const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) sender.replaceTrack(videoTrack);
            });
            const localVideo = document.getElementById('local-video');
            if (localVideo) localVideo.srcObject = window.localStream;
        }

        btn.innerHTML = '<i class="fas fa-desktop text-lg group-hover:scale-110 transition-transform"></i>';
        btn.style.color = 'white';
        btn.classList.remove('bg-indigo-600');

    } else {
        // Start sharing
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            const screenTrack = screenStream.getVideoTracks()[0];

            // Listen for native "Stop sharing" button click in browser
            screenTrack.onended = () => {
                toggleScreenShare(); // Revert
            };

            // Replace track in all peer connections
            Object.values(window.peerConnections).forEach(pc => {
                const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) sender.replaceTrack(screenTrack);
            });

            // Show locally
            const localVideo = document.getElementById('local-video');
            if (localVideo) localVideo.srcObject = screenStream;

            btn.innerHTML = '<i class="fas fa-desktop text-lg animate-pulse"></i>';
            btn.style.color = 'white';
            btn.classList.add('bg-indigo-600');

        } catch (e) {
            console.warn("Screen share denied/failed", e);
        }
    }
}

async function sendCallChatMessage() {
    const input = document.getElementById('call-chat-input');
    const text = input ? input.value.trim() : '';
    if (!text || !window.activeCallContextId) return;

    if (input) input.value = '';

    // Inject local message to panel immediately
    appendCallChatMessage(text, true);

    // Reuse existing send logic to broadcast to peer
    const chatData = window.openChats.get(window.activeCallContextId);
    if (!chatData) return;
    const { target } = chatData;

    const displayName = window.currentUser.user_metadata?.display_name || window.currentUser.email?.split('@')[0] || 'User';
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let payload = {
        user: displayName,
        userId: window.currentUser.id,
        senderId: window.currentUser.id,
        time,
        isCallChat: true, // Special flag for stream UI
        text // Not encrypting for temporary call chat for speed/simplicity
    };

    const ch = await window.getPeerChannel(target.id);
    await ch.send({ type: 'broadcast', event: 'dm', payload });
}

function appendCallChatMessage(text, isMe, senderName = 'You') {
    const container = document.getElementById('call-chat-history');
    if (!container) return;

    const div = document.createElement('div');
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isMe) {
        div.className = 'flex flex-col items-end animate-fade-in-up';
        div.innerHTML = `
            <div class="px-3 py-2 rounded-2xl rounded-tr-sm bg-indigo-600 text-white text-xs shadow-md max-w-[85%] break-words">
                ${text}
            </div>
            <span class="text-[9px] text-gray-500 mt-1 mr-1">${time}</span>
        `;
    } else {
        div.className = 'flex flex-col items-start animate-fade-in-up';
        div.innerHTML = `
            <span class="text-[9px] font-bold text-indigo-400 mb-0.5 ml-1">${senderName}</span>
            <div class="px-3 py-2 rounded-2xl rounded-tl-sm bg-white/10 border border-white/5 text-gray-200 text-xs shadow-md max-w-[85%] break-words">
                ${text}
            </div>
            <span class="text-[9px] text-gray-500 mt-1 ml-1">${time}</span>
        `;
    }

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

window.showIncomingCallModal = showIncomingCallModal;
window.showActiveCallWindow = showActiveCallWindow;
window.toggleMute = toggleMute;
window.toggleCamera = toggleCamera;
window.toggleScreenShare = toggleScreenShare;
window.sendCallChatMessage = sendCallChatMessage;
window.appendCallChatMessage = appendCallChatMessage;
