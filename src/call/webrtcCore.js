// ============================================================
// WEBRTC CALLING
// ============================================================

let pendingCallOffer = null;
let pendingCallType = null;
let pendingCallerId = null;
let pendingCallerName = null;
let pendingContextId = null;

let rtcPeerConnection = null; // Legacy 1:1 format fallback
window.peerConnections = {};  // New Mesh Network state
let localStream = null;
let activeCallContextId = null;
let callTimer = null;
let callDuration = 0;

async function startCall(contextId, callType) {
    // Basic fallback toast if undefined globally
    if (typeof window.showToast !== 'function') {
        window.showToast = function (msg, type = 'info') {
            const toast = document.createElement('div');
            const bg = type === 'error' ? 'bg-red-600' : 'bg-indigo-600';
            toast.className = `fixed top-12 left-1/2 transform -translate-x-1/2 ${bg} text-white px-4 py-2 rounded shadow-2xl z-[99999] text-sm font-bold animate-fade-in-up transition-opacity duration-300`;
            toast.textContent = msg;
            document.body.appendChild(toast);
            setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
        };
    }

    if (Object.keys(window.peerConnections).length > 0) { window.showToast('Already in a call.', 'error'); return; }

    // Determine targets (1-to-1 or Group)
    let targets = [];
    const isGroup = contextId.includes('_') && contextId.split('_').length > 2;
    let callTitle = 'Call';

    if (isGroup) {
        const uids = contextId.split('_').filter(id => id !== currentUser.id);
        uids.forEach(uid => { if (allProfiles[uid]) targets.push(allProfiles[uid]); });
        callTitle = `Group Call (${targets.length + 1})`;
    } else {
        const targetId = contextId.replace(currentUser.id, '').replace('_', '');
        if (allProfiles[targetId]) {
            targets.push(allProfiles[targetId]);
            callTitle = targets[0].name;
        }
    }

    if (targets.length === 0) { window.showToast('Target user(s) not found.', 'error'); return; }

    activeCallContextId = contextId;
    const displayName = currentUser.user_metadata?.display_name || currentUser.email?.split('@')[0] || 'User';

    // Show Active Call Window immediately
    showActiveCallWindow(callTitle, callType);
    const audioNameBig = document.getElementById('audio-peer-name-big');
    if (audioNameBig) audioNameBig.textContent = "Requesting Camera/Mic...";
    const nameBadge = document.getElementById('call-peer-name');
    if (nameBadge) nameBadge.textContent = "Requesting Camera/Mic...";

    try {
        if (!navigator.mediaDevices) throw new Error("Media devices not supported (secure context required e.g. localhost or https).");
        localStream = await navigator.mediaDevices.getUserMedia({ video: callType === 'video', audio: true });

        if (callType === 'video') {
            const localVideo = document.getElementById('local-video');
            if (localVideo) localVideo.srcObject = localStream;
        }
    } catch (e) {
        window.showToast('Could not access camera/microphone: ' + e.message, 'error');
        endCall();
        return;
    }

    if (nameBadge) nameBadge.textContent = "Ringing " + callTitle + "...";
    if (audioNameBig) audioNameBig.textContent = "Ringing...";

    // Initiate Mesh connections
    for (const target of targets) {
        const pc = new RTCPeerConnection(RTC_CONFIG);
        window.peerConnections[target.user_id] = pc;

        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

        pc.onicecandidate = (e) => {
            if (e.candidate) signalToPeer(target.user_id, { type: 'ice-candidate', candidate: e.candidate, contextId, senderId: currentUser.id });
        };

        pc.ontrack = (e) => {
            handleRemoteStream(e.streams[0], target.user_id, target.name);
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        signalToPeer(target.user_id, { type: 'call-offer', offer, callType, callerName: displayName, callerId: currentUser.id, contextId, isGroup });
    }

    startRing(true);

    window._pendingOutCallTarget = { name: callTitle };
    window._pendingOutCallType = callType;
}

function handleRemoteStream(stream, peerId, peerName) {
    const videoArea = document.getElementById('video-area');
    if (!videoArea) return;

    const isAudioOnly = stream.getVideoTracks().length === 0;

    // Hide standard 1-to-1 video placeholder logic only for video calls
    const oldRemote = document.getElementById('remote-video');
    const placeholder = document.getElementById('audio-call-placeholder');

    if (!isAudioOnly) {
        if (oldRemote) oldRemote.classList.add('hidden');
        if (placeholder) placeholder.classList.add('hidden');
    }

    let mediaEl = document.getElementById(`remote-video-${peerId}`);
    if (!mediaEl) {
        if (isAudioOnly) {
            mediaEl = document.createElement('audio');
            mediaEl.id = `remote-video-${peerId}`;
            mediaEl.autoplay = true;
            mediaEl.className = 'hidden';
            videoArea.appendChild(mediaEl);
        } else {
            const wrapper = document.createElement('div');
            wrapper.className = 'relative flex-1 min-w-[300px] h-full rounded-2xl overflow-hidden shadow-2xl animate-fade-in-up group';
            wrapper.id = `remote-wrap-${peerId}`;

            mediaEl = document.createElement('video');
            mediaEl.id = `remote-video-${peerId}`;
            mediaEl.autoplay = true;
            mediaEl.playsInline = true;
            mediaEl.className = 'w-full h-full object-cover';

            const nameTag = document.createElement('div');
            nameTag.className = 'absolute bottom-4 left-4 px-3 py-1.5 rounded-lg backdrop-blur-md bg-black/40 border border-white/10 text-white text-xs font-bold shadow-lg flex items-center gap-2';
            nameTag.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> ${peerName}`;

            wrapper.appendChild(mediaEl);
            wrapper.appendChild(nameTag);

            // Transform the flex container into a grid for groups
            videoArea.className = 'flex-1 bg-black relative flex flex-wrap gap-4 p-4';
            videoArea.appendChild(wrapper);
        }
    }
    mediaEl.srcObject = stream;
}

async function signalToPeer(peerId, payload) {
    console.log(`[WebRTC] Sending signal to peer ${peerId}:`, payload.type);
    const ch = await getPeerChannel(peerId);
    ch.send({ type: 'broadcast', event: 'webrtc-signal', payload });
}

// ===== RING TONE =====
let _ringInterval = null;
let _ringCtx = null;
function startRing(isOutgoing = false) {
    stopRing();
    function beep() {
        try {
            _ringCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (isOutgoing) {
                // Outgoing: Long dial tone beep
                const osc = _ringCtx.createOscillator();
                const gain = _ringCtx.createGain();
                osc.connect(gain); gain.connect(_ringCtx.destination);
                osc.frequency.value = 440; // Lower pitch like European dial tone
                gain.gain.setValueAtTime(0.15, _ringCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, _ringCtx.currentTime + 1.2);
                osc.start(_ringCtx.currentTime);
                osc.stop(_ringCtx.currentTime + 1.2);
            } else {
                // Incoming: Double sharp beep
                [0, 0.2].forEach(delay => {
                    const osc = _ringCtx.createOscillator();
                    const gain = _ringCtx.createGain();
                    osc.connect(gain); gain.connect(_ringCtx.destination);
                    osc.frequency.value = 880;
                    gain.gain.setValueAtTime(0.35, _ringCtx.currentTime + delay);
                    gain.gain.exponentialRampToValueAtTime(0.001, _ringCtx.currentTime + delay + 0.16);
                    osc.start(_ringCtx.currentTime + delay);
                    osc.stop(_ringCtx.currentTime + delay + 0.16);
                });
            }
        } catch (e) { }
    }
    beep();
    _ringInterval = setInterval(beep, isOutgoing ? 3000 : 1800);
}
function stopRing() {
    clearInterval(_ringInterval); _ringInterval = null;
    if (_ringCtx) { try { _ringCtx.close(); } catch (e) { } _ringCtx = null; }
}

async function acceptCall() {
    stopRing();
    dismissCallNotification(); // close the browser call notification
    document.getElementById('incoming-call-modal').classList.add('hidden');
    if (!pendingCallOffer) return;

    activeCallContextId = pendingContextId;
    showActiveCallWindow(pendingCallerName, pendingCallType);

    const nameBadge = document.getElementById('call-peer-name');
    if (nameBadge) nameBadge.textContent = "Connecting Camera/Mic...";

    try {
        if (!navigator.mediaDevices) throw new Error("Media devices not supported (secure context required e.g. localhost or https).");
        localStream = await navigator.mediaDevices.getUserMedia({ video: pendingCallType === 'video', audio: true });

        if (pendingCallType === 'video') {
            const localVideo = document.getElementById('local-video');
            if (localVideo) localVideo.srcObject = localStream;
        }
    } catch (e) {
        if (typeof window.showToast === 'function') window.showToast('Could not access camera/microphone: ' + e.message, 'error');
        else alert('Could not access camera/microphone: ' + e.message);
        endCall();
        return;
    }

    if (nameBadge) nameBadge.textContent = pendingCallerName;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    window.peerConnections[pendingCallerId] = pc;
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.onicecandidate = (e) => {
        if (e.candidate) signalToPeer(pendingCallerId, { type: 'ice-candidate', candidate: e.candidate, contextId: pendingContextId, senderId: currentUser.id });
    };

    pc.ontrack = (e) => {
        handleRemoteStream(e.streams[0], pendingCallerId, pendingCallerName);
    };

    await pc.setRemoteDescription(new RTCSessionDescription(pendingCallOffer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    signalToPeer(pendingCallerId, { type: 'call-answer', answer, contextId: pendingContextId, senderId: currentUser.id });
    startCallTimer();
}

function declineCall() {
    stopRing();
    dismissCallNotification(); // close the browser call notification
    document.getElementById('incoming-call-modal').classList.add('hidden');
    if (pendingCallerId) signalToPeer(pendingCallerId, { type: 'call-declined', contextId: pendingContextId, senderId: currentUser.id });
    pendingCallOffer = null;
}

function endCall(isRemote = false) {
    stopRing();

    // Broadcast hangup if we initiated it
    if (!isRemote) {
        Object.keys(window.peerConnections).forEach(peerId => {
            signalToPeer(peerId, { type: 'call-ended', contextId: activeCallContextId, senderId: currentUser.id });
        });
    }

    // Cleanup mesh connections
    Object.values(window.peerConnections).forEach(pc => pc.close());
    window.peerConnections = {};

    localStream?.getTracks().forEach(t => t.stop());
    localStream = null;
    const localVideo = document.getElementById('local-video');
    if (localVideo) localVideo.srcObject = null;

    clearInterval(callTimer);
    callDuration = 0;
    const timerEl = document.getElementById('call-timer');
    if (timerEl) timerEl.textContent = '00:00';

    // Cleanup remote video/audio DOM elements
    const videoArea = document.getElementById('video-area');
    if (videoArea) {
        Array.from(videoArea.children).forEach(child => {
            if (child.id && child.id.startsWith('remote-wrap-')) {
                const vid = child.querySelector('video');
                if (vid) vid.srcObject = null;
                child.remove();
            }
            if (child.id && child.id.startsWith('remote-video-')) {
                child.srcObject = null;
                child.remove();
            }
        });
        const oldRemote = document.getElementById('remote-video');
        if (oldRemote) {
            oldRemote.srcObject = null;
            oldRemote.classList.remove('hidden');
        }
    }

    // Reset Stream UI elements
    const chatHistory = document.getElementById('call-chat-history');
    if (chatHistory) {
        chatHistory.innerHTML = `
            <div class="text-center text-[10px] text-gray-500 italic my-2 p-2 bg-white/5 rounded-lg border border-white/5">
                Welcome to the meeting chat. Messages sent here are visible to call participants.
            </div>
        `;
    }
    const rightSidebar = document.getElementById('call-right-sidebar');
    if (rightSidebar) {
        rightSidebar.classList.add('translate-x-full', 'w-0', 'opacity-0');
        rightSidebar.classList.remove('w-80');
    }

    document.getElementById('active-call-window').classList.add('hidden');
    document.getElementById('incoming-call-modal').classList.add('hidden');
    if (activeCallContextId) {
        appendMessageToWindow(activeCallContextId, { userId: currentUser.id, text: `ðŸ“µ Call ended`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isSystem: true });
    }
    activeCallContextId = null;
}

function startCallTimer() {
    callDuration = 0;
    clearInterval(callTimer);
    callTimer = setInterval(() => {
        callDuration++;
        const m = String(Math.floor(callDuration / 60)).padStart(2, '0');
        const s = String(callDuration % 60).padStart(2, '0');
        const timerEl = document.getElementById('call-timer');
        if (timerEl) timerEl.textContent = `${m}:${s}`;
    }, 1000);
}

async function handleWebRTCSignal(payload) {
    const { type, contextId, senderId } = payload;
    console.log(`[WebRTC] Received signal from ${senderId}:`, type);

    if (type === 'call-offer') {
        pendingCallOffer = payload.offer;

        // Block receiving own calls
        if (senderId === currentUser.id) return;

        // Auto-answer if already in same group call
        if (activeCallContextId === contextId && localStream) {
            const pc = new RTCPeerConnection(RTC_CONFIG);
            window.peerConnections[payload.callerId] = pc;
            localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
            pc.onicecandidate = e => { if (e.candidate) signalToPeer(payload.callerId, { type: 'ice-candidate', candidate: e.candidate, contextId, senderId: currentUser.id }); };
            pc.ontrack = e => handleRemoteStream(e.streams[0], payload.callerId, payload.callerName);
            await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            signalToPeer(payload.callerId, { type: 'call-answer', answer, contextId, senderId: currentUser.id });
            return;
        }

        pendingCallType = payload.callType;
        pendingCallerId = payload.callerId;
        pendingCallerName = payload.callerName || 'Unknown Caller';
        pendingContextId = contextId;

        try {
            showIncomingCallModal(pendingCallerName, pendingCallType);
            playNotificationSound();
        } catch (e) {
            console.error("Error displaying incoming call modal", e);
        }
    }
    else if (type === 'call-answer') {
        stopRing();
        const pc = window.peerConnections[senderId];
        if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
            if (window._pendingOutCallTarget && window._pendingOutCallType) {
                showActiveCallWindow(window._pendingOutCallTarget.name, window._pendingOutCallType);
                startCallTimer();
                window._pendingOutCallTarget = null;
                window._pendingOutCallType = null;
            }
        }
    }
    else if (type === 'ice-candidate') {
        const pc = window.peerConnections[senderId];
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
    }
    else if (type === 'call-declined') {
        stopRing();
        if (window.peerConnections[senderId]) {
            window.peerConnections[senderId].close();
            delete window.peerConnections[senderId];
            if (typeof window.showToast === 'function') window.showToast('A user declined the call.', 'error');
            if (Object.keys(window.peerConnections).length === 0) endCall(true);
        }
    }
    else if (type === 'call-ended') {
        if (typeof window.showToast === 'function') window.showToast('Call ended by participant.', 'info');
        endCall(true);
    }
}

// expose for external call
window.startCall = startCall;
window.acceptCall = acceptCall;
window.declineCall = declineCall;
window.endCall = endCall;
window.toggleMute = toggleMute;
window.toggleCamera = toggleCamera;


