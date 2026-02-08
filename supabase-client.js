
// --- SUPABASE CLIENT CONFIGURATION ---
const SUPABASE_URL = 'https://etdqyrkihsbritcikpbi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0ZHF5cmtpaHNicml0Y2lrcGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NTMxNzksImV4cCI6MjA4NjAyOTE3OX0.gNVhroMQpc_2Yl3p8UyjdalTqzeUHvLgjcu-XxBWI1I';

// Check if Supabase SDK is loaded
if (typeof supabase === 'undefined') {
    console.error('Supabase SDK not loaded! Make sure to include the CDN script in your HTML.');
}

// Initialize Client
const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- AUTHENTICATION FUNCTIONS ---

/**
 * Sign Up New User with Name
 * @param {string} email 
 * @param {string} password 
 * @param {string} name 
 */
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

/**
 * Sign In Existing User
 * @param {string} email 
 * @param {string} password 
 */
async function signIn(email, password) {
    const { data, error } = await sbClient.auth.signInWithPassword({
        email: email,
        password: password,
    });
    return { data, error };
}

/**
 * Sign Out User
 */
async function signOut() {
    const { error } = await sbClient.auth.signOut();
    if (!error) {
        window.location.href = 'login.html';
    }
    return { error };
}

/**
 * Get Current User Session
 */
async function getSession() {
    const { data, error } = await sbClient.auth.getSession();
    return { session: data.session, error };
}

/**
 * Route Guard - Auto Redirect if Not Logged In
 * Call this at the start of protected pages
 */
async function requireAuth() {
    const { session } = await getSession();
    if (!session) {
        // Redirect to login if no session
        // Store current URL to redirect back after login (optional future enhancement)
        window.location.href = 'login.html';
    } else {
        console.log("User Authenticated:", session.user.email);

        let displayName = session.user.user_metadata.display_name;

        if (!displayName) {
            // Fallback: Extract name from email (e.g., amit@meril.com -> Amit)
            const emailName = session.user.email.split('@')[0];
            displayName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
        }
        // Final fallback if displayName is still empty after email extraction
        displayName = displayName || "User";

        // Inject Logout Button and Name
        injectHeaderInfo(displayName);
    }
}

/**
 * Inject User Name and Logout Button into Header
 */
function injectHeaderInfo(name) {
    // Try to find the header actions container
    // Matches the existing header structure in validators
    const startBtn = document.querySelector('button[onclick="location.reload()"]');

    // If not found, look for general header container
    const headerContainer = startBtn ? startBtn.parentNode : document.querySelector('.flex.items-center.gap-2');

    if (headerContainer && !document.getElementById('btnLogout')) {
        // Create User Name Span
        const userSpan = document.createElement('span');
        userSpan.className = 'text-gray-600 font-medium mr-4 text-sm hidden md:inline-block';
        userSpan.innerHTML = `Hello, <span class="text-indigo-600 font-bold">${name}</span>`;

        // Insert before the first button (if any) or append
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

/**
 * Save Tool Data (Upsert)
 * @param {string} toolName - e.g. 'MLSIPL'
 * @param {object} fileData - The JSON data to save
 */
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

/**
 * Load Tool Data
 * @param {string} toolName 
 */
async function loadUserData(toolName) {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) return null;

    // Check for auto-delete (Clean up old data on load)
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

/**
 * Delete User Data for a specific Tool
 * @param {string} toolName
 */
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

/**
 * Delete Data Older than 7 Days
 */
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

// --- REALTIME FEATURES (Active Users & Chat) ---

let realtimeChannel = null;
let currentUser = null;

/**
 * Initialize Realtime Features
 * Call this after successful login/restoration
 */
async function initRealtimeFeatures() {
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) return;

    currentUser = user;
    const displayName = user.user_metadata.display_name || user.email.split('@')[0];

    // 1. Inject UI Elements
    injectChatUI();
    injectActiveUsersUI();

    // 2. Initialize Channel
    realtimeChannel = sbClient.channel('room-global', {
        config: {
            presence: {
                key: user.id,
            },
        },
    });

    realtimeChannel
        .on('presence', { event: 'sync' }, () => {
            const state = realtimeChannel.presenceState();
            updateActiveUsersList(state);
        })
        .on('broadcast', { event: 'chat' }, (payload) => {
            appendChatMessage(payload.payload);
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await realtimeChannel.track({
                    user_id: user.id,
                    name: displayName,
                    online_at: new Date().toISOString(),
                });
            }
        });

    console.log("Realtime Features Initialized");
}

// --- UI INJECTION & HANDLING ---

function injectActiveUsersUI() {
    // container in header
    const header = document.querySelector('header .flex.items-center.gap-2') || document.body;

    // Check if exists
    if (document.getElementById('activeUsersPill')) return;

    const pill = document.createElement('div');
    pill.id = 'activeUsersPill';
    pill.className = 'flex items-center bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full ml-4 cursor-pointer relative group transition-all hover:bg-green-200';
    pill.innerHTML = `
        <span class="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
        <span id="activeCount">1 Online</span>
        
        <!-- Dropdown List -->
        <div class="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-2">
            <h6 class="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide border-b pb-1">Active Users</h6>
            <ul id="activeUsersList" class="space-y-1 max-h-40 overflow-y-auto">
                <!-- Users injected here -->
            </ul>
        </div>
    `;

    // Insert after "Hello User" if possible
    const userSpan = header.querySelector('span.text-gray-600');
    if (userSpan) {
        userSpan.parentNode.insertBefore(pill, userSpan.nextSibling);
    } else {
        header.appendChild(pill);
    }
}

function updateActiveUsersList(state) {
    const list = document.getElementById('activeUsersList');
    const countEl = document.getElementById('activeCount');
    if (!list || !countEl) return;

    list.innerHTML = '';
    let total = 0;

    // Flatten state
    // state = { "user_id": [ { name: "Amit", ... }, ... ] }
    Object.keys(state).forEach(key => {
        state[key].forEach(user => {
            total++;
            const li = document.createElement('li');
            li.className = 'flex items-center text-xs text-gray-700 py-1';
            li.innerHTML = `
                <div class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold mr-2 text-[10px]">
                    ${user.name.charAt(0).toUpperCase()}
                </div>
                <span>${user.name} ${user.user_id === currentUser.id ? '(You)' : ''}</span>
            `;
            list.appendChild(li);
        });
    });

    countEl.innerText = `${total} Online`;
}

function injectChatUI() {
    if (document.getElementById('chatWidget')) return;

    const widget = document.createElement('div');
    widget.id = 'chatWidget';
    widget.className = 'fixed bottom-4 right-4 z-50 flex flex-col items-end';
    widget.innerHTML = `
        <!-- Chat Window -->
        <div id="chatWindow" class="bg-white w-80 h-96 rounded-lg shadow-2xl border border-gray-200 flex flex-col mb-4 hidden transform transition-all origin-bottom-right">
            <!-- Header -->
            <div class="bg-indigo-600 text-white p-3 rounded-t-lg flex justify-between items-center cursor-pointer" onclick="toggleChat()">
                <div class="font-bold flex items-center"><i class="fas fa-comments mr-2"></i> Team Chat</div>
                <i class="fas fa-times hover:text-gray-200"></i>
            </div>
            
            <!-- Messages -->
            <div id="chatMessages" class="flex-1 p-3 overflow-y-auto bg-gray-50 space-y-2 text-sm">
                <div class="text-center text-gray-400 text-xs italic mt-2">Chat started. Messages are ephemeral.</div>
            </div>

            <!-- Input -->
            <div class="p-2 border-t bg-white flex">
                <input type="text" id="chatInput" class="flex-1 border rounded-l px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" placeholder="Type a message..." onkeypress="handleChatKey(event)">
                <button onclick="sendChat()" class="bg-indigo-600 text-white px-4 rounded-r hover:bg-indigo-700 transition"><i class="fas fa-paper-plane"></i></button>
            </div>
        </div>

        <!-- Floating Button -->
        <button id="chatFab" onclick="toggleChat()" class="bg-indigo-600 text-white w-14 h-14 rounded-full shadow-lg hover:bg-indigo-700 flex items-center justify-center transition-transform hover:scale-110 active:scale-95">
            <i class="fas fa-comment-dots text-2xl"></i>
            <span id="unreadBadge" class="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full hidden">0</span>
        </button>
    `;

    document.body.appendChild(widget);
}

// Global functions for Chat
window.toggleChat = function () {
    const win = document.getElementById('chatWindow');
    const badge = document.getElementById('unreadBadge');

    if (win.classList.contains('hidden')) {
        win.classList.remove('hidden');
        badge.classList.add('hidden');
        badge.innerText = '0';
        setTimeout(() => document.getElementById('chatInput').focus(), 100);
    } else {
        win.classList.add('hidden');
    }
};

window.handleChatKey = function (e) {
    if (e.key === 'Enter') sendChat();
};

window.sendChat = async function () {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text || !realtimeChannel) return;

    const displayName = currentUser.user_metadata.display_name || currentUser.email.split('@')[0];

    const payload = {
        user: displayName,
        userId: currentUser.id,
        text: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Send to channel
    await realtimeChannel.send({
        type: 'broadcast',
        event: 'chat',
        payload: payload
    });

    input.value = '';
    // Optimistic append
    // appendChatMessage(payload); // Optional: wait for broadcast to avoid duplicate if we want strict sync
};

function appendChatMessage(msg) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const isMe = msg.userId === currentUser.id;

    const div = document.createElement('div');
    div.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'}`;
    div.innerHTML = `
        <div class="max-w-[85%] ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'} px-3 py-2 rounded-lg shadow-sm">
            ${!isMe ? `<div class="text-[10px] font-bold opacity-75 mb-1">${msg.user}</div>` : ''}
            <div>${msg.text}</div>
            <div class="text-[9px] opacity-70 text-right mt-1">${msg.time}</div>
        </div>
    `;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    // Show Badge if closed
    const win = document.getElementById('chatWindow');
    if (win.classList.contains('hidden')) {
        const badge = document.getElementById('unreadBadge');
        badge.classList.remove('hidden');
        badge.innerText = parseInt(badge.innerText) + 1;

        // Sound effect (Optional)
        // new Audio('notification.mp3').play().catch(() => {});
    }
}

// Load Realtime on Auth
document.addEventListener('DOMContentLoaded', () => {
    // Wait slightly for auth to settle
    setTimeout(() => {
        if (typeof sbClient !== 'undefined') {
            initRealtimeFeatures();
        }
    }, 1500);
});
