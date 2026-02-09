
// --- SUPABASE CLIENT CONFIGURATION ---
const SUPABASE_URL = 'https://etdqyrkihsbritcikpbi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0ZHF5cmtpaHNicml0Y2lrcGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NTMxNzksImV4cCI6MjA4NjAyOTE3OX0.gNVhroMQpc_2Yl3p8UyjdalTqzeUHvLgjcu-XxBWI1I';

// --- ENCRYPTION CONFIGURATION (Pseudo-E2EE for Prototype) ---
const MASTER_SALT = 'MERIL_CHAT_V1_SALT_SUPER_SECRET';

// Check if Supabase SDK is loaded
if (typeof supabase === 'undefined') {
    console.error('Supabase SDK not loaded! Make sure to include the CDN script in your HTML.');
}

// Initialize Client
const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- AUTHENTICATION FUNCTIONS ---

async function signUp(email, password, name) {
    const { data, error } = await sbClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                display_name: name,
            }
        }
    });
    return { data, error };
}

async function signIn(email, password) {
    const { data, error } = await sbClient.auth.signInWithPassword({
        email: email,
        password: password,
    });
    return { data, error };
}

async function signOut() {
    const { error } = await sbClient.auth.signOut();
    if (!error) {
        window.location.href = 'login.html';
    }
    return { error };
}

async function getSession() {
    const { data, error } = await sbClient.auth.getSession();
    return { session: data.session, error };
}

async function requireAuth() {
    const { session } = await getSession();
    if (!session) {
        window.location.href = 'login.html';
    } else {
        console.log("User Authenticated:", session.user.email);

        let displayName = session.user.user_metadata.display_name;

        if (!displayName) {
            const emailName = session.user.email.split('@')[0];
            displayName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
        }
        displayName = displayName || "User";

        injectHeaderInfo(displayName);
    }
}

function injectHeaderInfo(name) {
    const startBtn = document.querySelector('button[onclick="location.reload()"]');
    const headerContainer = startBtn ? startBtn.parentNode : document.querySelector('.flex.items-center.gap-2');

    if (headerContainer && !document.getElementById('btnLogout')) {
        const userSpan = document.createElement('span');
        userSpan.className = 'text-gray-600 font-medium mr-4 text-sm hidden md:inline-block';
        userSpan.innerHTML = `Hello, <span class="text-indigo-600 font-bold">${name}</span>`;

        if (headerContainer.firstChild) {
            headerContainer.insertBefore(userSpan, headerContainer.firstChild);
        } else {
            headerContainer.appendChild(userSpan);
        }

        const btn = document.createElement('button');
        btn.id = 'btnLogout';
        btn.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
        btn.className = 'bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded text-sm font-bold shadow transition ml-2';
        btn.title = "Logout";
        btn.onclick = signOut;
        headerContainer.appendChild(btn);
    }
}

// --- DATA PERSISTENCE FUNCTIONS ---

async function saveUserData(toolName, fileData) {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) return;

    const { error } = await sbClient
        .from('user_data')
        .upsert({
            user_id: user.id,
            tool_name: toolName,
            file_data: fileData,
            updated_at: new Date()
        }, { onConflict: 'user_id, tool_name' });

    if (error) console.error("Save Error:", error);
    else console.log("Data Saved Automatically!");
}

async function loadUserData(toolName) {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) return null;

    await deleteOldData(user.id);

    const { data, error } = await sbClient
        .from('user_data')
        .select('file_data')
        .eq('user_id', user.id)
        .eq('tool_name', toolName)
        .single();

    if (error) return null;
    return data ? data.file_data : null;
}

async function deleteUserData(toolName) {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) return;

    const { error } = await sbClient
        .from('user_data')
        .delete()
        .eq('user_id', user.id)
        .eq('tool_name', toolName);

    if (error) console.error("Delete Error:", error);
    else console.log("Data Deleted Successfully!");
}

async function deleteOldData(userId) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { error } = await sbClient
        .from('user_data')
        .delete()
        .eq('user_id', userId)
        .lt('created_at', sevenDaysAgo.toISOString());

    if (error) console.error("Cleanup Error:", error);
}

// --- CRYPTO UTILS (AES-GCM) ---

const CryptoUtils = {
    async getKey(roomContext) {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw",
            enc.encode(MASTER_SALT + roomContext),
            { name: "PBKDF2" },
            false,
            ["deriveKey"]
        );

        return window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: enc.encode("somesalt"),
                iterations: 1000,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    },

    async encrypt(text, roomContext) {
        const key = await this.getKey(roomContext);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const enc = new TextEncoder();

        const encrypted = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            enc.encode(text)
        );

        const ivArr = Array.from(iv);
        const encArr = Array.from(new Uint8Array(encrypted));
        return btoa(JSON.stringify({ iv: ivArr, data: encArr }));
    },

    async decrypt(cipherText, roomContext) {
        try {
            const raw = JSON.parse(atob(cipherText));
            const iv = new Uint8Array(raw.iv);
            const data = new Uint8Array(raw.data);
            const key = await this.getKey(roomContext);

            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                key,
                data
            );

            const dec = new TextDecoder();
            return dec.decode(decrypted);
        } catch (e) {
            console.error("Decryption failed", e);
            return "[Encrypted Message]";
        }
    }
};


// --- REALTIME FEATURES (ZOHO STYLE DOCKED WINDOWS) ---

let globalChannel = null;
let privateChannel = null;
let currentUser = null;

let openChats = new Map();
let selectedUsersForGroup = new Set();
let lastPresenceState = {};
let allProfiles = {};
let currentTab = 'all';
let searchQuery = '';

/**
 * Initialize Realtime Features
 */
async function initRealtimeFeatures() {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) return;

    currentUser = user;
    const displayName = user.user_metadata.display_name || user.email.split('@')[0];

    try {
        await sbClient.from('profiles').upsert({
            id: user.id,
            email: user.email,
            username: displayName,
            last_seen: new Date(),
            avatar_url: null
        }, { onConflict: 'id' });
    } catch (e) { console.warn("Profile sync failed:", e); }

    // --- ADMIN CHECK ---
    try {
        const { data: profile } = await sbClient.from('profiles').select('role').eq('id', user.id).single();
        if (profile && profile.role === 'admin') {
            user.role = 'admin';
            console.log("Welcome Admin! Privileged features enabled.");
        } else {
            user.role = 'user';
        }
    } catch (e) { user.role = 'user'; }

    injectZohoUI();
    applyRoleBasedVisibility(user.role);
    await fetchAllProfiles();

    globalChannel = sbClient.channel('room-global', {
        config: { presence: { key: user.id } },
    });

    globalChannel
        .on('presence', { event: 'sync' }, () => {
            const state = globalChannel.presenceState();
            updateContactsList(state);
        })
        .on('broadcast', { event: 'chat' }, async (payload) => {
            const msg = payload.payload;
            if (msg.cipher) msg.text = await CryptoUtils.decrypt(msg.cipher, "global");
            handleIncomingMessage(msg, 'global', 'global');
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await globalChannel.track({
                    user_id: user.id,
                    name: displayName,
                    online_at: new Date().toISOString(),
                });
            }
        });

    privateChannel = sbClient.channel(`room-private-${user.id}`);

    privateChannel
        .on('broadcast', { event: 'dm' }, async (payload) => {
            const msg = payload.payload;
            let contextId;
            let type = 'private';

            if (msg.groupId) {
                contextId = msg.groupId;
                type = 'group';
            } else {
                contextId = [msg.senderId, currentUser.id].sort().join('_');
            }

            if (msg.cipher) msg.text = await CryptoUtils.decrypt(msg.cipher, contextId);
            msg.isDetails = true;

            handleIncomingMessage(msg, contextId, type);
        })
        .subscribe();

    console.log("Zoho Realtime Initialized");
}

async function fetchAllProfiles() {
    try {
        const { data, error } = await sbClient
            .from('profiles')
            .select('*')
            .order('last_seen', { ascending: false });

        if (data) {
            data.forEach(p => {
                allProfiles[p.id] = {
                    user_id: p.id,
                    name: p.username || p.email,
                    last_seen: p.last_seen,
                    role: p.role || 'user'
                };
            });
            updateContactsList(lastPresenceState || {});
        }
    } catch (e) { console.log("Offline profiles not available"); }
}

// Sound Effect
const notificationAudio = new Audio("data:audio/mp3;base64,//uQRAAAAWMSLwUIYAAsYkXgoQwAEaYLWfkWgAI0wWs/ItAAAGzrCXowAAACAAAAAAAAAAIQIwIGJmZmZmmJmZmZnAAAAMrAABh4AAAKxAAApr4AAAO4AAAD0YAACPZAAAb18AAO5oAADmrAAACK4AAD3DAAApmwAAOpMAACmRAAACoIAAAGCAAegmpmZmhmZmZmMAAAAAAAAAAAAAAA==");

function playNotificationSound() {
    notificationAudio.play().catch(e => console.log("Audio play failed:", e));
}

function handleIncomingMessage(msg, contextId, type) {
    // Play sound if message is from someone else
    if ((msg.userId && msg.userId !== currentUser.id) || (msg.senderId && msg.senderId !== currentUser.id)) {
        playNotificationSound();
    }

    if (openChats.has(contextId)) {
        appendMessageToWindow(contextId, msg);
    } else {
        let targetName = msg.user;
        let targetId = msg.senderId;

        let target;
        if (type === 'global') {
            target = { id: 'global', name: 'Global Chat' };
        } else if (type === 'group') {
            target = { groupId: contextId, name: 'Group Chat', isGroup: true };
        } else {
            target = { id: targetId, name: targetName };
        }

        openDockedChat(target, type);
        appendMessageToWindow(contextId, msg);
    }
}

// --- UI INJECTION & HANDLING (ADVANCED ZOHO STYLE) ---

function injectZohoUI() {
    if (document.getElementById('zoho-container')) return;

    const container = document.createElement('div');
    container.id = 'zoho-container';
    container.className = 'fixed bottom-0 right-0 z-50 flex items-end font-sans pointer-events-none';

    container.innerHTML = `
        <div id="zoho-dock-area" class="flex items-end justify-end mr-4 pointer-events-auto space-x-3 mb-0"></div>
        
        <div id="zoho-contacts-widget" class="pointer-events-auto bg-white w-80 shadow-2xl border border-gray-200 rounded-t-xl flex flex-col transition-all duration-300 mr-4 overflow-hidden">
            <div class="bg-gradient-to-r from-gray-900 to-gray-800 text-white px-4 py-3 cursor-pointer flex justify-between items-center h-12" onclick="toggleContactsWidget()">
                <div class="flex items-center font-semibold tracking-wide text-sm">
                    <div class="relative">
                        <i class="fas fa-comment-alt mr-2"></i>
                        <span id="zoho-online-badge" class="absolute -top-2 -right-1 bg-green-500 text-[9px] px-1 rounded-full border border-gray-900 hidden">0</span>
                    </div>
                    Messaging
                </div>
                <div class="flex items-center space-x-3">
                     <i class="fas fa-expand-alt text-xs opacity-50 hover:opacity-100" title="Expand"></i>
                     <i id="zoho-contacts-icon" class="fas fa-chevron-up text-xs transition-transform duration-300"></i>
                </div>
            </div>
            
            <div id="zoho-contacts-body" class="bg-gray-50 flex-1 flex flex-col hidden" style="height: 450px; max-height: 85vh;">
                <div class="bg-white border-b border-gray-200 p-2">
                    <div class="relative mb-2">
                        <i class="fas fa-search absolute left-3 top-2.5 text-gray-400 text-xs"></i>
                        <input type="text" placeholder="Search contacts..." 
                            class="w-full bg-gray-100 text-sm pl-8 pr-3 py-1.5 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                            onkeyup="handleSearch(event)">
                    </div>
                    <div class="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                        <button id="tab-all" class="flex-1 py-1 text-xs font-medium rounded-md bg-white shadow-sm text-gray-800 transition-all border border-gray-200" onclick="switchTab('all')">All</button>
                        <button id="tab-online" class="flex-1 py-1 text-xs font-medium rounded-md text-gray-500 hover:bg-gray-200 transition-all" onclick="switchTab('online')">Online</button>
                    </div>
                </div>

                <div id="group-action-bar" class="hidden bg-indigo-50 px-3 py-2 flex justify-between items-center border-b border-indigo-100">
                    <span class="text-xs text-indigo-700 font-bold"><span id="sel-count">0</span> selected</span>
                    <button class="bg-indigo-600 text-white text-[10px] px-2 py-1 rounded hover:bg-indigo-700 transition shadow-sm" onclick="createGroupFromSelection()">
                        Start Group
                    </button>
                </div>

                <ul id="zoho-contact-list" class="flex-1 overflow-y-auto p-0 m-0 custom-scrollbar relative">
                    <div class="flex flex-col items-center justify-center h-40 text-gray-400 space-y-2">
                        <i class="fas fa-circle-notch fa-spin"></i>
                        <span class="text-xs">Loading contacts...</span>
                    </div>
                </ul>

                <div class="p-2 border-t border-gray-200 bg-white flex justify-between items-center text-xs text-gray-500">
                    <div class="hover:text-indigo-600 cursor-pointer flex items-center px-2 py-1 hover:bg-gray-50 rounded" onclick="openDockedChat({id:'global',name:'Global Chat'}, 'global')">
                        <i class="fas fa-globe mr-1"></i> Global Chat
                    </div>
                    
                    <!-- Admin Button Removed -->

                    <div class="hover:text-gray-800 cursor-pointer p-1" onclick="fetchAllProfiles()">
                        <i class="fas fa-sync-alt" title="Refresh"></i>
                    </div>
                </div>
            </div>
        </div>
    `;

    const style = document.createElement('style');
    style.innerHTML = `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 4px; }
        .animate-fade-in-up { animation: fadeInUp 0.3s ease-out; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    `;
    document.head.appendChild(style);
    document.body.appendChild(container);

    // Image Upload Logic (Paste & Drag)
    window.addEventListener('paste', handleGlobalPaste);
}

function toggleContactsWidget() {
    const widget = document.getElementById('zoho-contacts-widget');
    const body = document.getElementById('zoho-contacts-body');
    const icon = document.getElementById('zoho-contacts-icon');

    if (body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        widget.style.height = 'auto';
        icon.style.transform = 'rotate(180deg)';
    } else {
        body.classList.add('hidden');
        widget.style.height = '48px';
        icon.style.transform = 'rotate(0deg)';
    }
}

function handleSearch(e) {
    searchQuery = e.target.value.toLowerCase();
    renderContacts();
}

function switchTab(tab) {
    currentTab = tab;
    document.getElementById('tab-all').className = tab === 'all'
        ? "flex-1 py-1 text-xs font-medium rounded-md bg-white shadow-sm text-gray-800 transition-all border border-gray-200"
        : "flex-1 py-1 text-xs font-medium rounded-md text-gray-500 hover:bg-gray-200 transition-all";
    document.getElementById('tab-online').className = tab === 'online'
        ? "flex-1 py-1 text-xs font-medium rounded-md bg-white shadow-sm text-gray-800 transition-all border border-gray-200"
        : "flex-1 py-1 text-xs font-medium rounded-md text-gray-500 hover:bg-gray-200 transition-all";
    renderContacts();
}

function updateContactsList(state) {
    lastPresenceState = state;
    renderContacts();
}

function renderContacts() {
    const list = document.getElementById('zoho-contact-list');
    const badge = document.getElementById('zoho-online-badge');
    const selCount = document.getElementById('sel-count');
    const groupBar = document.getElementById('group-action-bar');

    if (!list) return;

    const onlineUserIds = new Set();
    if (lastPresenceState) {
        Object.keys(lastPresenceState).forEach(key => {
            lastPresenceState[key].forEach(u => onlineUserIds.add(u.user_id));
        });
    }

    let combinedUsers = { ...allProfiles };
    if (lastPresenceState) {
        Object.keys(lastPresenceState).forEach(key => {
            lastPresenceState[key].forEach(u => {
                if (!combinedUsers[u.user_id]) {
                    combinedUsers[u.user_id] = {
                        user_id: u.user_id,
                        name: u.name,
                        last_seen: new Date(),
                        role: u.role || 'user'
                    };
                }
            });
        });
    }

    let users = Object.values(combinedUsers).filter(u => u.user_id !== currentUser.id);
    users.sort((a, b) => {
        const aOnline = onlineUserIds.has(a.user_id);
        const bOnline = onlineUserIds.has(b.user_id);
        if (aOnline && !bOnline) return -1;
        if (!aOnline && bOnline) return 1;
        return (a.name || '').localeCompare(b.name || '');
    });

    list.innerHTML = '';
    let totalOnline = 0;

    users.forEach(user => {
        const isOnline = onlineUserIds.has(user.user_id);
        if (isOnline) totalOnline++;

        if (currentTab === 'online' && !isOnline) return;
        if (searchQuery && !user.name.toLowerCase().includes(searchQuery)) return;

        const isSelected = selectedUsersForGroup.has(user.user_id);
        const li = document.createElement('li');
        li.className = `px-3 py-2 flex items-center cursor-pointer border-b border-gray-50 transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}`;

        // Admin Badge Logic
        const isAdmin = user.role === 'admin';
        const adminBadge = isAdmin ? `<span class="ml-1 text-[9px] bg-red-100 text-red-600 px-1 rounded border border-red-200 font-bold">ADMIN</span>` : '';

        li.innerHTML = `
            <div class="flex items-center justify-center mr-3" onclick="event.stopPropagation()">
                 <input type="checkbox" class="form-checkbox h-3 w-3 text-indigo-600 rounded focus:ring-0 cursor-pointer" 
                 ${isSelected ? 'checked' : ''} 
                 onchange="toggleZohoSelection(event, '${user.user_id}')">
            </div>
            
            <div class="flex items-center flex-1" onclick="openDockedChat({id: '${user.user_id}', name: '${user.name}'}, 'private')">
                <div class="relative mr-3">
                     <div class="w-8 h-8 rounded-full ${isOnline ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'} flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                        ${user.name.charAt(0)}
                     </div>
                     ${isOnline ? '<span class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></span>' : ''}
                </div>
                <div class="flex-1 min-w-0">
                    <h5 class="text-xs font-semibold text-gray-800 truncate flex items-center">${user.name} ${adminBadge}</h5>
                    <p class="text-[10px] ${isOnline ? 'text-green-600 font-medium' : 'text-gray-400'}">${isOnline ? 'Online' : 'Offline'}</p>
                </div>
            </div>
        `;
        list.appendChild(li);
    });

    if (list.children.length === 0) {
        list.innerHTML = `
            <div class="flex flex-col items-center justify-center h-32 text-gray-400">
                <i class="fas fa-user-slash text-2xl mb-2 opacity-50"></i>
                <span class="text-xs">No contacts found</span>
            </div>
        `;
    }

    if (badge) {
        badge.innerText = totalOnline;
        if (totalOnline > 0) badge.classList.remove('hidden');
        else badge.classList.add('hidden');
    }

    if (selectedUsersForGroup.size > 0) {
        groupBar.classList.remove('hidden');
        selCount.innerText = selectedUsersForGroup.size;
    } else {
        groupBar.classList.add('hidden');
    }
}

function toggleZohoSelection(e, userId) {
    if (e.target.checked) selectedUsersForGroup.add(userId);
    else selectedUsersForGroup.delete(userId);
    renderContacts();
}

function createGroupFromSelection() {
    if (selectedUsersForGroup.size === 0) return;

    const members = Array.from(selectedUsersForGroup);
    members.push(currentUser.id);
    const groupId = members.sort().join('_');
    const groupName = `Group (${members.length})`;

    const target = {
        groupId: groupId,
        name: groupName,
        members: members,
        isGroup: true
    };

    openDockedChat(target, 'group');
    selectedUsersForGroup.clear();
    renderContacts();
}


// --- DOCKED CHAT WINDOW LOGIC ---

function openDockedChat(target, type) {
    let contextId;
    if (type === 'global') contextId = 'global';
    else if (type === 'group') contextId = target.groupId;
    else contextId = [currentUser.id, target.id].sort().join('_');

    if (openChats.has(contextId)) {
        const input = document.getElementById(`input-${contextId}`);
        if (input) input.focus();
        return;
    }

    if (openChats.size >= 3) {
        const firstKey = openChats.keys().next().value;
        closeDockedChat(firstKey);
    }

    openChats.set(contextId, { target, type });

    const dockArea = document.getElementById('zoho-dock-area');
    const win = document.createElement('div');
    win.id = `chat-window-${contextId}`;
    win.className = "bg-white w-72 border border-blue-100 rounded-t-lg shadow-xl flex flex-col pointer-events-auto transition-all animate-fade-in-up relative";
    win.style.height = "350px";

    let colorClass, iconClass;
    if (type === 'global') { colorClass = 'text-blue-500'; iconClass = 'fa-globe'; }
    else if (type === 'group') { colorClass = 'text-indigo-500'; iconClass = 'fa-users'; }
    else { colorClass = 'text-green-500'; iconClass = 'fa-circle'; }

    win.innerHTML = `
        <div class="bg-white border-b border-gray-200 px-3 py-2 rounded-t-lg flex justify-between items-center cursor-pointer hover:bg-gray-50 h-10 select-none" onclick="toggleDockBody('${contextId}')">
            <div class="flex items-center text-sm font-bold text-gray-700 truncate flex-1 mr-2">
                <i class="fas ${iconClass} ${colorClass} mr-2 text-xs"></i>
                <span class="truncate">${target.name}</span>
            </div>
            <div class="flex items-center text-gray-400 space-x-3">
                <i class="fas fa-minus text-xs hover:text-gray-600" title="Minimize"></i>
                <i class="fas fa-times text-xs hover:text-red-500" onclick="closeDockedChat('${contextId}', event)" title="Close"></i>
            </div>
        </div>
        
        <div id="chat-body-${contextId}" class="flex flex-col flex-1 bg-gray-50 overflow-hidden relative">
            <div id="drop-zone-${contextId}" class="absolute inset-0 bg-indigo-50 bg-opacity-95 flex flex-col items-center justify-center z-20 hidden border-2 border-dashed border-indigo-400 m-2 rounded-lg pointer-events-none">
                <i class="fas fa-cloud-upload-alt text-3xl text-indigo-500 mb-2"></i>
                <span class="text-xs font-bold text-indigo-700">Drop files to share</span>
            </div>

            <div id="msg-container-${contextId}" class="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
                <div class="text-center text-gray-300 text-[10px] mt-2 mb-2 italic">Start of conversation</div>
            </div>
            
            <div class="p-2 bg-white border-t border-gray-200 flex items-center gap-2">
                <button class="text-gray-400 hover:text-indigo-600 transition-colors p-1" onclick="document.getElementById('file-input-${contextId}').click()" title="Attach File">
                    <i class="fas fa-paperclip"></i>
                </button>
                <input type="file" id="file-input-${contextId}" class="hidden" onchange="handleFileUpload(event, '${contextId}')" />
                
                <input id="input-${contextId}" type="text" 
                    class="flex-1 bg-gray-100 border-0 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                    placeholder="Type..." 
                    onkeypress="handleDockKey(event, '${contextId}')">
                    
                <button class="text-indigo-600 hover:text-indigo-800 p-1" onclick="sendDockMessage('${contextId}')">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
    `;

    dockArea.appendChild(win);

    const body = document.getElementById(`chat-body-${contextId}`);
    const dropZone = document.getElementById(`drop-zone-${contextId}`);

    // Drag & Drop
    win.addEventListener('dragenter', (e) => { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('hidden'); });
    win.addEventListener('dragleave', (e) => {
        if (e.relatedTarget && !win.contains(e.relatedTarget)) {
            dropZone.classList.add('hidden');
        }
    });
    win.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
    win.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('hidden');
        if (e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0], contextId);
    });

    setTimeout(() => document.getElementById(`input-${contextId}`).focus(), 100);
}

function toggleDockBody(contextId) {
    const body = document.getElementById(`chat-body-${contextId}`);
    const win = document.getElementById(`chat-window-${contextId}`);

    if (body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        win.style.height = "350px";
    } else {
        body.classList.add('hidden');
        win.style.height = "40px";
    }
}

function closeDockedChat(contextId, e) {
    if (e) e.stopPropagation();
    const win = document.getElementById(`chat-window-${contextId}`);
    if (win) win.remove();
    openChats.delete(contextId);
}

window.handleDockKey = function (e, contextId) {
    if (e.key === 'Enter') sendDockMessage(contextId);
}

function handleGlobalPaste(e) {
    // Only sort of works if focus is on a specific input, but let's try to detect active element
    const activeEl = document.activeElement;
    if (activeEl && activeEl.id && activeEl.id.startsWith('input-')) {
        const contextId = activeEl.id.replace('input-', '');
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.kind === 'file') {
                const blob = item.getAsFile();
                uploadFile(blob, contextId);
                // Don't prevent default if it's text, but do if it's file
            }
        }
    }
}

async function handleFileUpload(e, contextId) {
    if (e.target.files.length > 0) {
        await uploadFile(e.target.files[0], contextId);
        e.target.value = '';
    }
}

async function uploadFile(file, contextId) {
    if (file.size > 10 * 1024 * 1024) {
        alert("File too large! Max 10MB.");
        return;
    }

    const tempId = 'upload-' + Date.now();
    appendMessageToWindow(contextId, {
        userId: currentUser.id,
        text: `<i class="fas fa-spinner fa-spin mr-1"></i> Uploading ${file.name}...`,
        time: 'Now',
        isSystem: true,
        id: tempId
    });

    try {
        const fileExt = file.name.split('.').pop();
        // folder structure: chat-attachments/userId/timestamp.ext
        const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;

        const { data, error } = await sbClient.storage
            .from('chat-attachments')
            .upload(fileName, file);

        if (error) throw error;

        const { data: { publicUrl } } = sbClient.storage
            .from('chat-attachments')
            .getPublicUrl(fileName);

        const tempEl = document.getElementById(tempId);
        if (tempEl) tempEl.remove();

        await sendDockMessage(contextId, {
            type: file.type.startsWith('image/') ? 'image' : 'file',
            url: publicUrl,
            name: file.name
        });

    } catch (err) {
        console.error("Upload failed", err);
        const tempEl = document.getElementById(tempId);
        if (tempEl) tempEl.innerHTML = `<span class="text-red-500 text-[10px]">Upload failed: ${err.message}. (Did you create the bucket?)</span>`;
    }
}

async function sendDockMessage(contextId, attachment = null) {
    const input = document.getElementById(`input-${contextId}`);
    let text = input ? input.value.trim() : '';

    if (!text && !attachment) return;

    const chatData = openChats.get(contextId);
    if (!chatData) return;

    const { target, type } = chatData;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const displayName = currentUser.user_metadata.display_name || currentUser.email.split('@')[0];

    let payload = {
        user: displayName,
        userId: currentUser.id,
        senderId: currentUser.id,
        time: time,
        attachment: attachment
    };

    if (text) {
        const cipher = await CryptoUtils.encrypt(text, contextId);
        payload.cipher = cipher;
    } else {
        payload.text = "";
    }

    payload.isPrivate = (type !== 'global');
    if (payload.isPrivate && type === 'group') payload.groupId = contextId;

    if (type === 'global') {
        globalChannel.send({ type: 'broadcast', event: 'chat', payload });
    } else {
        const recipients = type === 'group' ? target.members : [target.id];
        recipients.forEach(async (rid) => {
            if (rid === currentUser.id) return;
            const ch = sbClient.channel(`room-private-${rid}`);
            await ch.subscribe();
            await ch.send({ type: 'broadcast', event: 'dm', payload });
            sbClient.removeChannel(ch);
        });
    }

    appendMessageToWindow(contextId, { ...payload, text: text, isDetails: true });
    if (input) input.value = '';
}

function appendMessageToWindow(contextId, msg) {
    const container = document.getElementById(`msg-container-${contextId}`);
    if (!container) return;

    if (msg.isSystem) {
        const div = document.createElement('div');
        div.id = msg.id || '';
        div.className = "text-center text-xs text-gray-400 my-1";
        div.innerHTML = msg.text;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        return;
    }

    const isMe = msg.userId === currentUser.id || msg.senderId === currentUser.id;
    const div = document.createElement('div');
    div.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fade-in-up mb-2`;

    let contentHtml = '';

    if (msg.attachment) {
        if (msg.attachment.type === 'image') {
            contentHtml += `
                <div class="mb-1 transform transition hover:scale-[1.02]">
                    <img src="${msg.attachment.url}" alt="Image" 
                        class="max-w-[200px] max-h-[150px] rounded-lg border border-gray-200 cursor-pointer shadow-sm"
                        onclick="window.open('${msg.attachment.url}', '_blank')">
                </div>
            `;
        } else {
            contentHtml += `
                <div class="mb-1 bg-gray-50 p-2 rounded border border-gray-100 flex items-center gap-2 max-w-[200px]">
                    <i class="fas fa-file-alt text-gray-400 text-lg"></i>
                    <a href="${msg.attachment.url}" target="_blank" class="text-xs text-blue-600 font-medium hover:underline truncate flex-1">${msg.attachment.name}</a>
                </div>
            `;
        }
    }

    if (msg.text) {
        contentHtml += `<div class="leading-snug break-words">${msg.text}</div>`;
    }

    div.innerHTML = `
        <div class="max-w-[85%] ${isMe ? 'bg-indigo-600 text-white rounded-t-lg rounded-bl-lg' : 'bg-white border border-gray-200 text-gray-800 rounded-t-lg rounded-br-lg shadow-sm'} px-3 py-2 relative group">
            ${!isMe && msg.groupId ? `<div class="text-[9px] font-bold text-indigo-300 mb-0.5">${msg.user}</div>` : ''}
            ${contentHtml}
            <div class="text-[9px] opacity-60 text-right mt-0.5 select-none">${msg.time}</div>
        </div>
    `;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}


document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof sbClient !== 'undefined') {
            initRealtimeFeatures();
        }
    }, 1500);
});


// --- ADMIN UI VISIBILITY ---

function applyRoleBasedVisibility(role) {
    // Default to 'user' if undefined
    const currentRole = role || 'user';
    console.log(`Applying visibility for role: ${currentRole}`);

    const adminElements = document.querySelectorAll('[data-role="admin"]');
    adminElements.forEach(el => {
        if (currentRole === 'admin') {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });

    // If we have specific 'user' only elements (rare but possible)
    const userElements = document.querySelectorAll('[data-role="user"]');
    userElements.forEach(el => {
        if (currentRole === 'user') {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });
}
