
// --- SUPABASE CLIENT CONFIGURATION ---
const SUPABASE_URL = 'https://etdqyrkihsbritcikpbi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0ZHF5cmtpaHNicml0Y2lrcGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NTMxNzksImV4cCI6MjA4NjAyOTE3OX0.gNVhroMQpc_2Yl3p8UyjdalTqzeUHvLgjcu-XxBWI1I';

// --- ENCRYPTION CONFIGURATION (Pseudo-E2EE for Prototype) ---


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

        // Fetch Profile to get Role
        const { data: profile } = await sbClient
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (profile) {
            window.currentUser = profile;
            console.log("Current User Role:", profile.role);
        }

        let displayName = session.user.user_metadata.display_name;

        if (!displayName) {
            const emailName = session.user.email.split('@')[0];
            displayName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
        }
        displayName = displayName || "User";

        injectHeaderInfo(displayName, profile?.role || 'user');
        // Show What's New on first visit for this version
        setTimeout(() => showWhatsNewModal(), 800);
    }
}

// ===== WHAT'S NEW / CHANGELOG MODAL =====

const WHATS_NEW_VERSION = 'v2.4.0'; // bump this string whenever you add new entries

function showWhatsNewModal() {
    const seenKey = `whatsNew_seen_${WHATS_NEW_VERSION}`;
    if (localStorage.getItem(seenKey)) return; // already seen this version

    if (document.getElementById('whats-new-modal')) return;

    const updates = [
        { cat: '🎨 UI', color: '#e0e7ff', text: 'color:#4f46e5', label: 'New Messaging Panel — 3-tab design (Chats / Calls / Video Calls) with gradient header' },
        { cat: '🎨 UI', color: '#e0e7ff', text: 'color:#4f46e5', label: 'Contact cards with gradient avatars, quick Chat / Call / Video buttons per contact' },
        { cat: '🎨 UI', color: '#e0e7ff', text: 'color:#4f46e5', label: 'Compact frosted search bar + All / Online pill toggle' },
        { cat: '✅ Fix', color: '#dcfce7', text: 'color:#16a34a', label: 'Chat window Close (×) and Minimize (−) buttons now work correctly' },
        { cat: '✅ Fix', color: '#dcfce7', text: 'color:#16a34a', label: 'Call timer now starts only AFTER the other person accepts — not before' },
        { cat: '✅ Fix', color: '#dcfce7', text: 'color:#16a34a', label: 'Profile photo no longer disappears on login — database persistence fixed' },
        { cat: '✅ Fix', color: '#dcfce7', text: 'color:#16a34a', label: 'Profile photos now correctly show in chat window header and contact list' },
        { cat: '🔔 New', color: '#fef9c3', text: 'color:#ca8a04', label: 'Incoming call ring tone using Web Audio API' },
        { cat: '🔔 New', color: '#fef9c3', text: 'color:#ca8a04', label: 'Browser push notifications for new messages and incoming calls (even when tab is minimized)' },
    ];

    const rows = updates.map(u => `
        <li style="display:flex; align-items:flex-start; gap:10px; padding:7px 0; border-bottom:1px solid #f3f4f6;">
            <span style="flex-shrink:0; font-size:10px; font-weight:700; padding:2px 8px; border-radius:50px; background:${u.color}; ${u.text};">${u.cat}</span>
            <span style="font-size:12.5px; color:#374151; line-height:1.4;">${u.label}</span>
        </li>`).join('');

    const html = `
    <div id="whats-new-modal" style="
        position:fixed; inset:0; z-index:9999;
        display:flex; align-items:center; justify-content:center;
        background:rgba(15,15,40,0.55); backdrop-filter:blur(4px);
        animation:fadeInBg 0.3s ease;">

        <div style="
            background:white; border-radius:20px; width:100%; max-width:480px; margin:16px;
            box-shadow:0 25px 60px rgba(0,0,0,0.25);
            animation:slideUp 0.35s ease; overflow:hidden;">

            <!-- Header -->
            <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed); padding:20px 24px 16px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <div style="font-size:11px; font-weight:700; color:rgba(255,255,255,0.7); letter-spacing:0.1em; text-transform:uppercase; margin-bottom:4px;">✨ What's New</div>
                        <div style="font-size:20px; font-weight:900; color:white;">${WHATS_NEW_VERSION} — Latest Updates</div>
                        <div style="font-size:11px; color:rgba(255,255,255,0.65); margin-top:2px;">February 2026</div>
                    </div>
                    <button onclick="closeWhatsNew()" style="
                        background:rgba(255,255,255,0.15); border:none; color:white;
                        width:30px; height:30px; border-radius:50%; cursor:pointer;
                        font-size:14px; display:flex; align-items:center; justify-content:center;">×</button>
                </div>
            </div>

            <!-- Update list -->
            <div style="padding:4px 24px 0; max-height:340px; overflow-y:auto;">
                <ul style="list-style:none; margin:0; padding:0;">
                    ${rows}
                </ul>
            </div>

            <!-- Footer -->
            <div style="padding:14px 24px 18px; border-top:1px solid #f3f4f6; display:flex; justify-content:space-between; align-items:center;">
                <label style="display:flex; align-items:center; gap:6px; font-size:12px; color:#6b7280; cursor:pointer;">
                    <input type="checkbox" id="wn-dont-show" style="accent-color:#4f46e5;"> Don't show again
                </label>
                <button onclick="closeWhatsNew()" style="
                    background:linear-gradient(135deg,#4f46e5,#7c3aed); color:white; border:none;
                    padding:8px 22px; border-radius:50px; font-size:13px; font-weight:700;
                    cursor:pointer; box-shadow:0 4px 12px rgba(79,70,229,0.35);">
                    Got it! 🎉
                </button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
}

window.closeWhatsNew = function () {
    const modal = document.getElementById('whats-new-modal');
    if (!modal) return;
    if (document.getElementById('wn-dont-show')?.checked) {
        localStorage.setItem(`whatsNew_seen_${WHATS_NEW_VERSION}`, '1');
    }
    modal.style.opacity = '0';
    modal.style.transition = 'opacity 0.25s';
    setTimeout(() => modal.remove(), 280);
};

window.showWhatsNewModal = showWhatsNewModal;


function injectHeaderInfo(name, role) {
    const startBtn = document.querySelector('button[onclick="location.reload()"]');
    const headerContainer = startBtn ? startBtn.parentNode : document.querySelector('.flex.items-center.gap-2');

    if (headerContainer && !document.getElementById('btnLogout')) {
        const userSpan = document.createElement('span');
        userSpan.className = 'text-gray-600 font-medium mr-4 text-sm hidden md:inline-flex items-center gap-2';

        let badgeHtml = '';
        if (role === 'admin') {
            badgeHtml = `

            <div class="ml-2 adm-glow" style="display:inline-flex; pointer-events:none; user-select:none;
                filter: drop-shadow(0 0 10px rgba(6,182,212,0.6)) drop-shadow(0 0 24px rgba(6,182,212,0.25));">
                
                <!-- Badge card: dark acrylic glass -->
                <div style="
                    position: relative;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 16px 6px 12px;
                    border-radius: 10px;
                    background: linear-gradient(145deg, rgba(15,15,30,0.85) 0%, rgba(5,5,20,0.92) 100%);
                    border: 1.5px solid transparent;
                    background-clip: padding-box;
                    box-shadow:
                        0 0 0 1.5px rgba(34,211,238,0.55),
                        0 0 12px rgba(34,211,238,0.4),
                        0 0 30px rgba(34,211,238,0.15),
                        inset 0 1px 0 rgba(255,255,255,0.12),
                        inset 0 -1px 0 rgba(0,0,0,0.5);
                    backdrop-filter: blur(24px);
                ">
                    <!-- Top gloss reflection -->
                    <div style="position:absolute; top:0; left:0; right:0; height:40%; background: linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 100%); border-radius: 10px 10px 0 0; pointer-events:none;"></div>

                    <!-- Light sweep shimmer -->
                    <div class="adm-shimmer" style="position:absolute; top:0; bottom:0; width:40%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent); transform: skewX(-20deg); pointer-events:none;"></div>

                    <!-- Gold shield icon -->
                    <div style="position:relative; flex-shrink:0; width:28px; height:28px; display:flex; align-items:center; justify-content:center;">
                        <i class="fas fa-shield-alt" style="font-size:22px; background: linear-gradient(160deg,#fde68a,#f59e0b,#b45309); -webkit-background-clip:text; -webkit-text-fill-color:transparent; filter: drop-shadow(0 0 5px rgba(245,158,11,0.9)) drop-shadow(0 0 12px rgba(245,158,11,0.4));"></i>
                        <i class="fas fa-check" style="position:absolute; font-size:8px; color:#fef08a; text-shadow: 0 0 8px rgba(254,240,138,1), 0 0 16px rgba(253,224,71,0.8);"></i>
                    </div>

                    <!-- Text content -->
                    <div style="display:flex; flex-direction:column; align-items:flex-start; line-height:1.1;">
                        <!-- ADMIN â€” big neon cyan -->
                        <span style="
                            font-size: 15px;
                            font-weight: 900;
                            letter-spacing: 0.22em;
                            text-transform: uppercase;
                            background: linear-gradient(180deg, #cffafe 0%, #22d3ee 45%, #0891b2 100%);
                            -webkit-background-clip: text;
                            -webkit-text-fill-color: transparent;
                            text-shadow: none;
                            filter: drop-shadow(0 0 6px rgba(6,182,212,1)) drop-shadow(0 0 20px rgba(6,182,212,0.6));
                        ">ADMIN</span>
                        <!-- Welcome subtitle -->
                        <span style="
                            font-size: 9px;
                            font-weight: 500;
                            letter-spacing: 0.08em;
                            color: rgba(186,230,253,0.65);
                            margin-top: 1px;
                        ">Welcome, ${name}</span>
                    </div>
                </div>
            </div>`;
        }

        const avatarUrl = window.currentUser?.avatar_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?s=100&d=mp&r=g';

        userSpan.innerHTML = `
        <div class="flex items-center gap-2 mr-3 border-r border-gray-200 pr-4">
            <div onclick="openProfileModal()" class="cursor-pointer group relative">
                <div class="w-8 h-8 rounded-full overflow-hidden border-2 border-indigo-100 shadow-sm group-hover:border-indigo-500 transition-all duration-300">
                    <img id="header-avatar" src="${avatarUrl}" alt="Avatar" class="w-full h-full object-cover">
                </div>
                <div class="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <i class="fas fa-camera text-white text-[10px]"></i>
                </div>
            </div>
            <div class="flex flex-col">
                <div class="flex items-center">
                    <span class="opacity-80 text-xs">Hello, </span>
                    <span class="text-indigo-600 font-extrabold text-sm tracking-tight ml-1 cursor-pointer hover:underline" onclick="openProfileModal()">${name}</span>
                    ${badgeHtml}
                </div>
            </div>
        </div>`;

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

// --- PROFILE SETTINGS UI ---

function injectProfileModal() {
    if (document.getElementById('profile-modal')) return;

    const modalHTML = `
    <!-- User Profile Modal -->
    <div id="profile-modal" class="hidden fixed inset-0 z-[100] flex items-center justify-center">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onclick="closeProfileModal()"></div>

        <!-- Modal Content -->
        <div class="relative bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-full max-w-lg transform scale-95 opacity-0 transition-all duration-300 overflow-hidden" id="profile-modal-content">
            
            <!-- Header -->
            <div class="relative h-28 bg-gradient-to-r from-indigo-600 to-purple-600">
                <button onclick="closeProfileModal()" class="absolute top-4 right-4 text-white/80 hover:text-white transition-colors bg-black/20 hover:bg-black/40 rounded-full w-8 h-8 flex items-center justify-center">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <div class="px-8 pb-8">
                <!-- Avatar Section -->
                <div class="relative -mt-14 mb-6 flex flex-col items-center justify-center">
                    <div class="relative group cursor-pointer" onclick="document.getElementById('avatar-upload').click()">
                        <div class="w-28 h-28 rounded-full border-4 border-white shadow-xl overflow-hidden bg-white">
                            <img id="modal-avatar-preview" src="${window.currentUser?.avatar_url || 'https://www.gravatar.com/avatar/?d=mp'}" class="w-full h-full object-cover" alt="Profile avatar">
                        </div>
                        
                        <label class="absolute bottom-0 right-0 bg-indigo-600 hover:bg-indigo-700 text-white w-9 h-9 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-transform hover:scale-110 border-2 border-white">
                            <i class="fas fa-camera text-sm"></i>
                            <input type="file" id="avatar-upload" class="hidden" accept="image/*" onchange="handleAvatarUpload(event)">
                        </label>

                        <!-- Loading overlay for avatar upload -->
                        <div id="avatar-loading" class="hidden absolute inset-0 bg-white/70 rounded-full flex items-center justify-center border-4 border-white backdrop-blur-sm">
                            <i class="fas fa-circle-notch fa-spin text-indigo-600 text-2xl"></i>
                        </div>
                    </div>
                    <span class="mt-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 shadow-sm cursor-pointer hover:bg-indigo-100 transition-colors" onclick="document.getElementById('avatar-upload').click()">
                        <i class="fas fa-upload mr-1"></i> Change Photo
                    </span>
                </div>

                <!-- Profile Info Section -->
                <div class="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <h4 class="text-sm font-bold text-gray-800 mb-3 flex items-center"><i class="fas fa-user-edit text-indigo-500 mr-2"></i>Personal Info</h4>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-xs font-medium text-gray-500 mb-1">Display Name</label>
                            <div class="flex gap-2">
                                <input type="text" id="modal-user-nameInput" class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" placeholder="Enter your name">
                                <button onclick="handleNameChange()" id="btn-change-name" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow text-sm transition-all whitespace-nowrap">
                                    Update Name
                                </button>
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-gray-500 mb-1">Email Address</label>
                            <div class="bg-gray-100 text-gray-600 px-3 py-2 rounded-lg text-sm border border-gray-200 flex items-center gap-2">
                                <i class="fas fa-envelope text-gray-400"></i>
                                <span id="modal-user-email">email@example.com</span>
                            </div>
                            <p class="text-[10px] text-gray-400 mt-1 italic">* Email cannot be changed</p>
                        </div>
                    </div>
                </div>

                <!-- Security Section -->
                <div class="bg-indigo-50/30 p-4 rounded-xl border border-indigo-100">
                    <h4 class="text-sm font-bold text-gray-800 mb-3 flex items-center"><i class="fas fa-shield-alt text-indigo-500 mr-2"></i>Change Password</h4>
                    <div id="password-section" class="space-y-3">
                        <div>
                            <div class="relative">
                                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <i class="fas fa-key text-gray-400 text-xs"></i>
                                </div>
                                <input type="password" id="new-password" placeholder="New password" class="pl-9 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors">
                            </div>
                        </div>

                        <div>
                            <div class="relative">
                                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <i class="fas fa-check-circle text-gray-400 text-xs"></i>
                                </div>
                                <input type="password" id="confirm-password" placeholder="Confirm new password" class="pl-9 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors">
                            </div>
                        </div>
                        
                        <div id="password-error" class="hidden text-red-500 text-xs mt-1 font-medium bg-red-50 p-2 rounded border border-red-100"></div>

                        <button onclick="handlePasswordChange()" id="btn-change-password" class="w-full bg-white border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-bold py-2 px-4 rounded-lg shadow-sm transition-all text-sm flex justify-center items-center">
                            <span>Update Password</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Simple Toast Container -->
    <div id="toast-container" class="fixed bottom-4 right-4 z-[200] flex flex-col gap-2"></div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

window.openProfileModal = function () {
    injectProfileModal(); // Ensure it exists

    // Populate user details based on current session
    if (window.currentUser) {
        document.getElementById('modal-user-nameInput').value = window.currentUser.username || 'User';
        document.getElementById('modal-user-email').innerText = window.currentUser.email || '';
    } else {
        sbClient.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                document.getElementById('modal-user-nameInput').value = user.user_metadata?.display_name || user.email.split('@')[0];
                document.getElementById('modal-user-email').innerText = user.email;
            }
        });
    }

    const modal = document.getElementById('profile-modal');
    const content = document.getElementById('profile-modal-content');

    // Show Modal
    modal.classList.remove('hidden');

    // Animate In
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
};

window.closeProfileModal = function () {
    const modal = document.getElementById('profile-modal');
    const content = document.getElementById('profile-modal-content');

    if (!modal) return;

    // Animate Out
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');

    setTimeout(() => {
        modal.classList.add('hidden');
        // Reset inputs
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
        document.getElementById('password-error').classList.add('hidden');
    }, 300);
};

window.showToast = function (message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');

    const icon = type === 'success' ? 'fa-check-circle text-green-500' : 'fa-exclamation-circle text-red-500';
    const borderClass = type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50';

    toast.className = `flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg transform translate-y-10 opacity-0 transition-all duration-300 ${borderClass}`;
    toast.innerHTML = `
        <i class="fas ${icon} text-lg"></i>
        <div class="text-sm font-medium text-gray-800">${message}</div>
    `;

    container.appendChild(toast);

    // Animate in
    setTimeout(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    }, 10);

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('translate-y-2', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

window.handlePasswordChange = async function () {
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const errorEl = document.getElementById('password-error');
    const btn = document.getElementById('btn-change-password');

    errorEl.classList.add('hidden');

    if (newPassword.length < 6) {
        errorEl.innerText = "Password must be at least 6 characters long.";
        errorEl.classList.remove('hidden');
        return;
    }

    if (newPassword !== confirmPassword) {
        errorEl.innerText = "Passwords do not match.";
        errorEl.classList.remove('hidden');
        return;
    }

    // Loading State
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Updating...`;
    btn.disabled = true;

    try {
        const { data, error } = await sbClient.auth.updateUser({
            password: newPassword
        });

        if (error) {
            errorEl.innerText = error.message;
            errorEl.classList.remove('hidden');
        } else {
            showToast('Password updated successfully!');
            setTimeout(closeProfileModal, 1000);
        }
    } catch (err) {
        errorEl.innerText = "An unexpected error occurred.";
        errorEl.classList.remove('hidden');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

window.handleNameChange = async function () {
    const newName = document.getElementById('modal-user-nameInput').value.trim();
    const btn = document.getElementById('btn-change-name');

    if (!newName) {
        showToast('Name cannot be empty.', 'error');
        return;
    }

    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) return;

    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
    btn.disabled = true;

    try {
        // Update user metadata in Auth
        const { error: authError } = await sbClient.auth.updateUser({
            data: { display_name: newName }
        });
        if (authError) throw authError;

        // Update profiles table
        const { error: profileError } = await sbClient
            .from('profiles')
            .update({ username: newName })
            .eq('id', user.id);
        if (profileError) throw profileError;

        // Local state update
        if (window.currentUser) {
            window.currentUser.username = newName;
        }

        showToast('Profile name updated successfully!');

        // Refresh the page or header to reflect new name
        setTimeout(() => location.reload(), 1500);

    } catch (err) {
        showToast(err.message || 'Failed to update name.', 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

window.handleAvatarUpload = async function (e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Please upload an image file.', 'error');
        return;
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB Max
        showToast('Image must be less than 2MB.', 'error');
        return;
    }

    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) return;

    document.getElementById('avatar-loading').classList.remove('hidden');

    try {
        // 1. Delete old avatar if it exists
        const { data: profile } = await sbClient
            .from('profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .single();

        if (profile && profile.avatar_url && profile.avatar_url.includes('/avatars/')) {
            // Extract the file path from the full URL (everything after /avatars/)
            try {
                const urlParts = profile.avatar_url.split('/avatars/');
                const oldFilePath = urlParts[1];
                if (oldFilePath) {
                    await sbClient.storage.from('avatars').remove([oldFilePath]);
                    console.log("Old avatar deleted:", oldFilePath);
                }
            } catch (e) { console.warn("Could not delete old avatar", e); }
        }

        // 2. Upload to Supabase Storage. Bucket MUST be 'avatars'
        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}/${Math.random()}.${fileExt}`;

        const { error: uploadError } = await sbClient.storage
            .from('avatars')
            .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        // Get Public URL
        const { data } = sbClient.storage
            .from('avatars')
            .getPublicUrl(filePath);

        const newAvatarUrl = data.publicUrl;

        // Update Profiles table
        const { error: updateError } = await sbClient
            .from('profiles')
            .update({ avatar_url: newAvatarUrl })
            .eq('id', user.id);

        if (updateError) throw updateError;

        // Update Local UI Immediately
        document.getElementById('modal-avatar-preview').src = newAvatarUrl;
        const headerAvatar = document.getElementById('header-avatar');
        if (headerAvatar) headerAvatar.src = newAvatarUrl;

        if (window.currentUser) {
            window.currentUser.avatar_url = newAvatarUrl;
        }

        showToast('Profile picture updated successfully!');

    } catch (err) {
        console.error("Upload error:", err);
        showToast(err.message || 'Failed to update profile picture.', 'error');
    } finally {
        document.getElementById('avatar-loading').classList.add('hidden');
        e.target.value = ''; // Reset input
    }
};


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
        .maybeSingle();

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
    window.currentUser = user;
    const displayName = user.user_metadata.display_name || user.email.split('@')[0];

    try {
        await sbClient.from('profiles').upsert({
            id: user.id,
            email: user.email,
            username: displayName,
            last_seen: new Date()
            // NOTE: avatar_url is intentionally NOT included here —
            // including it as null would wipe the user's saved photo on every login.
            // avatar_url is only updated when the user explicitly uploads a new photo.
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
    requestNotificationPermission(); // ask browser for notification permission

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

            // Handle Stream UI embedded call chats first
            if (msg.isCallChat) {
                appendCallChatMessage(msg.text, false, msg.user);
                return; // Do not process as standard DM
            }

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

            // Update unread count if chat not open
            if (!openChats.has(contextId)) {
                unreadCounts[contextId] = (unreadCounts[contextId] || 0) + 1;
                renderContacts();
            }

            handleIncomingMessage(msg, contextId, type);
        })
        .on('broadcast', { event: 'typing' }, (payload) => {
            const { senderId, name, contextId } = payload.payload;
            if (senderId !== currentUser.id) {
                showTypingIndicator(contextId, name);
            }
        })
        .on('broadcast', { event: 'webrtc-signal' }, async (payload) => {
            await handleWebRTCSignal(payload.payload);
        })
        .on('broadcast', { event: 'messages-read' }, (payload) => {
            const { contextId, readerId } = payload.payload;
            if (readerId !== currentUser.id) {
                // Find all checkmarks in this context and turn them blue (double check)
                const container = document.getElementById(`msg-container-${contextId}`);
                if (container) {
                    const checks = container.querySelectorAll('.fa-check, .fa-check-double');
                    checks.forEach(icon => {
                        icon.className = 'fas fa-check-double text-[8px] text-blue-300 transition-colors duration-300';
                        icon.style.opacity = '1';
                    });
                }
            }
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
            allProfiles = data.reduce((acc, p) => {
                acc[p.id] = {
                    user_id: p.id,
                    name: p.username || p.email,
                    avatar_url: p.avatar_url || '',
                    last_seen: p.last_seen,
                    role: p.role || 'user'
                };
                return acc;
            }, {});
            window.allProfiles = allProfiles;
            updateContactsList(lastPresenceState || {});
        }
    } catch (e) { console.log("Offline profiles not available"); }
}

// Sound Effect
const notificationAudio = new Audio("data:audio/mp3;base64,//uQRAAAAWMSLwUIYAAsYkXgoQwAEaYLWfkWgAI0wWs/ItAAAGzrCXowAAACAAAAAAAAAAIQIwIGJmZmZmmJmZmZnAAAAMrAABh4AAAKxAAApr4AAAO4AAAD0YAACPZAAAb18AAO5oAADmrAAACK4AAD3DAAApmwAAOpMAACmRAAACoIAAAGCAAegmpmZmhmZmZmMAAAAAAAAAAAAAAA==");

function playNotificationSound() {
    notificationAudio.play().catch(e => console.log("Audio play failed:", e));
}

// ===== BROWSER NOTIFICATION SYSTEM =====

async function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        await Notification.requestPermission();
    }
}

function showChatNotification(senderName, messageText, avatarUrl, contextId, target, type) {
    // Only show if tab is not focused
    if (document.hasFocus()) return;
    if (Notification.permission !== 'granted') return;

    const truncated = messageText?.length > 60 ? messageText.substring(0, 60) + '...' : (messageText || 'New message');

    const notif = new Notification(`💬 ${senderName}`, {
        body: truncated,
        icon: avatarUrl || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?s=64&d=mp',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="%234f46e5"/></svg>',
        tag: `chat-${contextId}`,       // replaces previous notif for same chat
        renotify: true,
        silent: false
    });

    notif.onclick = () => {
        window.focus();
        // Open or focus the chat window
        if (!openChats.has(contextId)) {
            openDockedChat(target, type);
        } else {
            document.getElementById(`input-${contextId}`)?.focus();
        }
        notif.close();
    };

    // Auto-close after 5s
    setTimeout(() => notif.close(), 5000);
}

function showCallNotification(callerName, callType, avatarUrl) {
    if (Notification.permission !== 'granted') return;

    // Vibrate if supported
    if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);

    const notif = new Notification(`${callType === 'video' ? '📹 Video' : '📞 Audio'} Call`, {
        body: `${callerName} is calling you... Tap to answer`,
        icon: avatarUrl || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?s=64&d=mp',
        tag: 'incoming-call',
        requireInteraction: true,    // stays until user interacts
        silent: false
    });

    notif.onclick = () => {
        window.focus();
        notif.close();
    };

    // Store so we can close it when call is accepted/declined
    window._callNotif = notif;
}

function dismissCallNotification() {
    if (window._callNotif) { window._callNotif.close(); window._callNotif = null; }
}


function handleIncomingMessage(msg, contextId, type) {
    const isFromOther = (msg.userId && msg.userId !== currentUser.id) || (msg.senderId && msg.senderId !== currentUser.id);

    if (isFromOther) {
        playNotificationSound();

        // Browser notification when tab is not focused
        const senderName = msg.user || 'Someone';
        const senderProfile = allProfiles[msg.senderId || msg.userId];
        const avatarUrl = senderProfile?.avatar_url || '';

        let target;
        if (type === 'global') {
            target = { id: 'global', name: 'Global Chat' };
        } else if (type === 'group') {
            target = { groupId: contextId, name: 'Group Chat', isGroup: true };
        } else {
            target = { id: msg.senderId, name: senderName, avatar_url: avatarUrl };
        }

        showChatNotification(senderName, msg.text, avatarUrl, contextId, target, type);
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
    }
}


// --- UI INJECTION & HANDLING (ENHANCED PREMIUM CHAT) ---

const unreadCounts = {};
let typingTimers = {};

// ===== WEBRTC CALLING STATE =====

window.RTC_CONFIG = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

function injectZohoUI() {
    if (document.getElementById('zoho-container')) return;

    const container = document.createElement('div');
    container.id = 'zoho-container';
    container.className = 'fixed bottom-0 right-0 z-50 flex items-end font-sans pointer-events-none';

    container.innerHTML = `
        <div id="zoho-dock-area" class="flex items-end justify-end mr-4 pointer-events-auto space-x-3 mb-0"></div>
        
        <!-- CONTACTS PANEL -->
        <div id="zoho-contacts-widget" class="pointer-events-auto flex flex-col transition-all duration-300 mr-4 overflow-hidden"
            style="width:250px; background:white; box-shadow:0 -8px 40px rgba(99,102,241,0.18), 0 0 0 1px rgba(209,213,219,0.8); border-radius:16px 16px 0 0;">
            
            <!-- ===== HEADER ===== -->
            <div style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 60%,#a78bfa 100%); border-radius:16px 16px 0 0; padding:10px 14px 0 14px;">
                <!-- Title row -->
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background:rgba(255,255,255,0.2);">
                            <i class="fas fa-comment-dots text-white text-xs"></i>
                        </div>
                        <span class="text-white font-black text-sm tracking-wide">Messaging</span>
                        <span id="zoho-unread-total" class="hidden text-white text-[9px] font-black px-1.5 py-0.5 rounded-full" style="background:#ef4444;"></span>
                    </div>
                    <div class="flex items-center gap-2.5" style="color:rgba(255,255,255,0.8);">
                        <i class="fas fa-clone text-xs cursor-pointer hover:text-white transition-colors" title="New Group"></i>
                        <i class="fas fa-pen-to-square text-xs cursor-pointer hover:text-white transition-colors" title="New Message"></i>
                        <i id="zoho-contacts-icon" class="fas fa-chevron-down text-xs cursor-pointer hover:text-white transition-transform duration-300" onclick="toggleContactsWidget()" title="Collapse"></i>
                        <span id="zoho-online-badge" class="hidden text-white text-[9px] font-black px-1.5 py-0.5 rounded-full" style="background:#22c55e;"></span>
                    </div>
                </div>

                <!-- 3-Tab bar: Chats / Calls / Video Calls (Dots Only) -->
                <div class="flex" style="gap:1px;">
                    <button id="main-tab-chats" class="flex-1 py-1.5 flex items-center justify-center transition-all"
                        style="background:rgba(255,255,255,0.2); border-radius:8px 8px 0 0;"
                        onclick="switchMainTab('chats')" title="Chats">
                        <span class="w-2 h-2 rounded-full" style="background:#ef4444; box-shadow: 0 0 4px rgba(239,68,68,0.5);"></span>
                    </button>
                    <button id="main-tab-calls" class="flex-1 py-1.5 flex items-center justify-center transition-all"
                        style="background:transparent; border-radius:8px 8px 0 0;"
                        onclick="switchMainTab('calls')" title="Audio Calls">
                        <span class="w-2 h-2 rounded-full" style="background:#22c55e; box-shadow: 0 0 4px rgba(34,197,94,0.5);"></span>
                    </button>
                    <button id="main-tab-video" class="flex-1 py-1.5 flex items-center justify-center transition-all"
                        style="background:transparent; border-radius:8px 8px 0 0;"
                        onclick="switchMainTab('video')" title="Video Calls">
                        <span class="w-2 h-2 rounded-full" style="background:#f59e0b; box-shadow: 0 0 4px rgba(245,158,11,0.5);"></span>
                    </button>
                </div>
            </div>
            
            <!-- ===== BODY ===== -->
            <div id="zoho-contacts-body" class="flex-1 flex flex-col hidden" style="height:420px; max-height:80vh; background:#f0f2ff;">
                <!-- Search bar -->
                <div class="px-3 pt-2.5 pb-1.5">
                    <div class="relative">
                        <i class="fas fa-search absolute left-3 top-2.5 text-[10px]" style="color:#a5b4fc;"></i>
                        <input type="text" placeholder="Search people..."
                            class="w-full text-xs pl-8 pr-3 py-2 focus:outline-none transition-all"
                            style="background:rgba(255,255,255,0.85); color:#374151; border-radius:50px; border:none; box-shadow:0 2px 8px rgba(99,102,241,0.1);"
                            onfocus="this.style.boxShadow='0 0 0 3px rgba(99,102,241,0.2)';"
                            onblur="this.style.boxShadow='0 2px 8px rgba(99,102,241,0.1)';"
                            onkeyup="handleSearch(event)">
                    </div>
                </div>

                <!-- All / Online pill toggle -->
                <div class="px-3 pb-1.5">
                    <div class="flex rounded-full p-0.5" style="background:rgba(255,255,255,0.7); box-shadow:0 1px 4px rgba(99,102,241,0.1);">
                        <button id="tab-all" class="flex-1 py-1.5 text-[11px] font-bold rounded-full transition-all"
                            style="background:white; color:#4f46e5; box-shadow:0 2px 6px rgba(99,102,241,0.15);"
                            onclick="switchTab('all')">All</button>
                        <button id="tab-online" class="flex-1 py-1.5 text-[11px] font-semibold rounded-full flex items-center justify-center gap-1 transition-all"
                            style="background:transparent; color:#6b7280;"
                            onclick="switchTab('online')">
                            <span class="w-1.5 h-1.5 rounded-full" style="background:#22c55e;"></span> Online
                        </button>
                    </div>
                </div>

                <!-- Group selection bar -->
                <div id="group-action-bar" class="hidden mx-4 mb-2 px-3 py-2 flex justify-between items-center rounded-xl" style="background:#ede9fe;">
                    <span class="text-xs font-bold" style="color:#4f46e5;"><span id="sel-count">0</span> selected</span>
                    <button class="text-white text-[10px] px-3 py-1.5 rounded-full font-bold hover:opacity-90"
                        style="background:linear-gradient(90deg,#4f46e5,#7c3aed);"
                        onclick="createGroupFromSelection()">Start Group Chat</button>
                </div>

                <!-- Contacts list -->
                <ul id="zoho-contact-list" class="flex-1 overflow-y-auto px-3 space-y-2 pt-1 pb-2 custom-scrollbar">
                    <div class="flex flex-col items-center justify-center h-40 space-y-2">
                        <i class="fas fa-circle-notch fa-spin" style="color:#6366f1;"></i>
                        <span class="text-xs text-gray-400">Loading contacts...</span>
                    </div>
                </ul>

                <!-- Footer -->
                <div class="px-3 py-2 flex justify-between items-center" style="background:white; border-top:1px solid #e5e7eb;">
                    <button class="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full transition-all"
                        style="color:#4f46e5;"
                        onmouseover="this.style.background='#ede9fe';"
                        onmouseout="this.style.background='transparent';"
                        onclick="openDockedChat({id:'global',name:'Global Chat'}, 'global')">
                        <i class="fas fa-globe text-xs"></i> Global Chat
                    </button>
                    <button class="w-7 h-7 rounded-full flex items-center justify-center transition-all" style="color:#9ca3af;"
                        onmouseover="this.style.color='#4f46e5'; this.style.background='#ede9fe';"
                        onmouseout="this.style.color='#9ca3af'; this.style.background='transparent';"
                        onclick="fetchAllProfiles()" title="Refresh">
                        <i class="fas fa-rotate-right text-xs"></i>
                    </button>
                </div>
            </div>
        </div>
    `;

    const style = document.createElement('style');
    style.innerHTML = `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f3f4f6; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #c7d2fe; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #818cf8; }
        .animate-fade-in-up { animation: fadeInUp 0.22s cubic-bezier(0.34,1.56,0.64,1); }
        @keyframes fadeInUp { from { opacity:0; transform:translateY(14px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes typingBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
        .typing-dot { animation: typingBounce 1.2s infinite; display:inline-block; width:5px; height:5px; border-radius:50%; background:#6366f1; margin:0 1.5px; }
        .typing-dot:nth-child(2) { animation-delay:0.2s; background:#8b5cf6; }
        .typing-dot:nth-child(3) { animation-delay:0.4s; background:#a78bfa; }
        @keyframes ringPulse { 0%{box-shadow:0 0 0 0 rgba(34,197,94,0.7)} 70%{box-shadow:0 0 0 6px rgba(34,197,94,0)} 100%{box-shadow:0 0 0 0 rgba(34,197,94,0)} }
        .online-ring { animation: ringPulse 2s infinite; }
        @keyframes callRing { 0%,100%{transform:rotate(-12deg) scale(1.05)} 50%{transform:rotate(12deg) scale(1.05)} }
        .call-ring { animation: callRing 0.35s infinite ease-in-out; }
        @keyframes incomingGlow { 0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,0.4)} 50%{box-shadow:0 0 0 14px rgba(99,102,241,0)} }
        .incoming-glow { animation: incomingGlow 1.6s infinite; }
        .emoji-bar { transition: opacity 0.18s ease, transform 0.18s ease; }
        .msg-bubble:hover .emoji-bar { opacity:1 !important; transform:translateY(0) !important; pointer-events:auto !important; }
        .chat-contact-row { transition: background 0.12s; }
        .chat-contact-row:hover { background: #f5f3ff !important; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(container);

    // Incoming call modal
    const callModal = document.createElement('div');
    callModal.id = 'incoming-call-modal';
    callModal.className = 'hidden fixed inset-0 z-[999] flex items-center justify-center';
    callModal.innerHTML = `
        <div class="absolute inset-0 backdrop-blur-sm" style="background:rgba(0,0,0,0.4);"></div>
        <div class="relative rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-5 w-80 animate-fade-in-up"
            style="background:white; border:1px solid #e5e7eb; box-shadow:0 25px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(99,102,241,0.1);">
            
            <!-- Glowing avatar -->
            <div class="relative flex items-center justify-center">
                <div class="absolute w-32 h-32 rounded-full incoming-glow" style="background:transparent;"></div>
                <div class="absolute w-28 h-28 rounded-full" style="border:2px solid rgba(99,102,241,0.2);"></div>
                <div id="call-avatar-ring" class="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-black"
                    style="background:linear-gradient(135deg,#4f46e5,#7c3aed); box-shadow:0 0 20px rgba(99,102,241,0.35);">?</div>
            </div>
            
            <div class="text-center">
                <p class="font-black text-xl text-gray-900" id="incoming-caller-name">Someone</p>
                <p class="text-sm mt-1.5 text-indigo-500" id="incoming-call-type">ðŸ“¹ Incoming Video Call...</p>
            </div>
            
            <div class="flex gap-8 mt-1">
                <button onclick="declineCall()" 
                    class="w-16 h-16 rounded-full text-white text-xl flex items-center justify-center transition-all hover:scale-110"
                    style="background:linear-gradient(135deg,#dc2626,#ef4444); box-shadow:0 4px 15px rgba(239,68,68,0.4);">
                    <i class="fas fa-phone-slash"></i>
                </button>
                <button onclick="acceptCall()" 
                    class="w-16 h-16 rounded-full text-white text-xl flex items-center justify-center transition-all hover:scale-110 call-ring"
                    style="background:linear-gradient(135deg,#16a34a,#22c55e); box-shadow:0 4px 15px rgba(34,197,94,0.4);">
                    <i id="accept-call-icon" class="fas fa-video"></i>
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(callModal);

    // Premium Stream Chat Active Call Window
    const callWindow = document.createElement('div');
    callWindow.id = 'active-call-window';
    // Full screen overlay with hidden by default
    callWindow.className = 'hidden fixed inset-0 z-[9999] flex overflow-hidden animate-fade-in-up';
    callWindow.style.cssText = 'background:#000000; font-family:"Inter", sans-serif;';
    callWindow.innerHTML = `
        <!-- Left Sidebar (Navigation/Participants) -->
        <div class="w-64 flex flex-col flex-shrink-0 absolute md:relative inset-y-0 left-0 z-50 transition-all duration-300 transform" 
            style="background:rgba(20,20,30,0.85); backdrop-filter:blur(20px); border-right:1px solid rgba(255,255,255,0.08);" id="call-left-sidebar">
            <div class="p-4 border-b border-white/10 flex items-center justify-between">
                <div class="flex items-center gap-2 text-white">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-600 shadow-lg shadow-indigo-500/30">
                        <i class="fas fa-video text-sm"></i>
                    </div>
                    <div>
                        <h2 class="text-sm font-black tracking-wide">Stream<span class="text-indigo-400">Call</span></h2>
                        <div class="flex items-center gap-1.5 opacity-80">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <p class="text-[9px] font-mono tracking-widest text-emerald-400 uppercase font-bold" id="call-timer">00:00</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="flex-1 p-3 overflow-y-auto custom-scrollbar">
                <div class="mb-4">
                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-2">Participants (2)</p>
                    
                    <!-- Self -->
                    <div class="flex items-center justify-between p-2 rounded-xl mb-1 hover:bg-white/5 transition-colors cursor-pointer group">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs font-black border border-indigo-500/30 shrink-0">ME</div>
                            <div class="min-w-0">
                                <p class="text-xs font-bold text-white truncate">You</p>
                                <p class="text-[9px] text-gray-400">Host</p>
                            </div>
                        </div>
                        <i class="fas fa-microphone text-[10px] text-emerald-400"></i>
                    </div>

                    <!-- Peer -->
                    <div class="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-xs font-black border border-purple-500/30 shrink-0" id="call-peer-avatar-list">?</div>
                            <div class="min-w-0">
                                <p class="text-xs font-bold text-white truncate" id="call-peer-name-side">Calling...</p>
                                <p class="text-[9px] text-gray-400">Guest</p>
                            </div>
                        </div>
                        <i class="fas fa-microphone text-[10px] text-gray-500" id="peer-mic-icon"></i>
                    </div>
                </div>
                
                <div>
                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-2">Settings</p>
                    <button class="w-full text-left p-2 rounded-xl hover:bg-white/5 transition-colors text-xs text-gray-300 flex items-center gap-3">
                        <i class="fas fa-cog text-gray-500 w-4 text-center"></i> Device Settings
                    </button>
                    <button class="w-full text-left p-2 rounded-xl hover:bg-white/5 transition-colors text-xs text-gray-300 flex items-center gap-3">
                        <i class="fas fa-shield-alt text-gray-500 w-4 text-center"></i> Security
                    </button>
                </div>
            </div>
            
            <button class="absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-12 bg-gray-800 border border-gray-700 rounded-r-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition z-30"
                onclick="document.getElementById('call-left-sidebar').classList.toggle('-translate-x-full'); document.getElementById('call-left-sidebar').classList.toggle('w-0'); document.getElementById('call-left-sidebar').classList.toggle('w-64');">
                <i class="fas fa-chevron-left text-[10px]" id="left-panel-chevron"></i>
            </button>
        </div>

        <!-- Center Stage (Video Area) -->
        <div class="flex-1 flex flex-col relative z-10 transition-all duration-300 bg-[#0a0a0f]" id="video-area">
            
            <!-- Main Remote Video (Full Size) -->
            <div class="absolute inset-4 rounded-3xl overflow-hidden shadow-2xl bg-gray-900 border border-white/5">
                <video id="remote-video" autoplay playsinline class="w-full h-full object-cover"></video>
                
                <!-- Audio Only Placeholder -->
                <div id="audio-call-placeholder" class="hidden absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
                    <div class="relative w-32 h-32 flex items-center justify-center mb-6">
                        <div class="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" style="animation-duration: 3s;"></div>
                        <div class="absolute inset-4 rounded-full bg-indigo-500/40 animate-pulse"></div>
                        <div class="w-24 h-24 rounded-full flex items-center justify-center text-white text-4xl font-black relative z-10 shadow-2xl" 
                            id="audio-peer-avatar-big"
                            style="background:linear-gradient(135deg,#4f46e5,#7c3aed); border:2px solid rgba(255,255,255,0.2);">?</div>
                    </div>
                    <p class="text-xl font-bold text-white tracking-wide" id="audio-peer-name-big">Audio Call</p>
                    <p class="text-sm text-indigo-400 mt-1" id="call-type-label">Voice only</p>
                </div>
                
                <!-- Overlay Name Badge (Remote) -->
                <div class="absolute bottom-6 left-6 px-4 py-2 rounded-xl backdrop-blur-md bg-black/40 border border-white/10 text-white shadow-lg flex items-center gap-2 z-20">
                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span class="text-sm font-bold tracking-wide drop-shadow-md" id="call-peer-name">Calling...</span>
                </div>
            </div>

            <!-- Picture-in-Picture Local Video -->
            <div id="local-video-container" class="absolute bottom-24 right-4 md:bottom-8 md:right-8 w-24 h-32 md:w-48 md:h-32 rounded-2xl overflow-hidden shadow-2xl border-2 border-indigo-500/50 z-30 transition-all hover:scale-105 cursor-move"
                style="background:#111;">
                <video id="local-video" autoplay playsinline muted class="w-full h-full object-cover transform scale-x-[-1]"></video>
                <div class="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/50 backdrop-blur text-white text-[9px] font-bold border border-white/10">You</div>
            </div>

            <!-- Bottom Floating Control Bar -->
            <div class="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40 transition-all duration-300">
                <div class="px-6 py-3 rounded-2xl flex items-center gap-4 shadow-2xl border border-white/10"
                    style="background:rgba(20,20,30,0.85); backdrop-filter:blur(20px);">
                    
                    <button onclick="toggleMute()" id="btn-mute" title="Mute/Unmute Mic"
                        class="w-12 h-12 rounded-xl flex items-center justify-center transition-all hover:-translate-y-1 hover:shadow-lg group"
                        style="background:rgba(255,255,255,0.1); color:white;">
                        <i class="fas fa-microphone text-lg group-hover:scale-110 transition-transform"></i>
                    </button>
                    
                    <button onclick="toggleCamera()" id="btn-camera" title="Start/Stop Camera"
                        class="w-12 h-12 rounded-xl flex items-center justify-center transition-all hover:-translate-y-1 hover:shadow-lg group"
                        style="background:rgba(255,255,255,0.1); color:white;">
                        <i class="fas fa-video text-lg group-hover:scale-110 transition-transform"></i>
                    </button>
                    
                    <div class="w-px h-8 bg-white/10 mx-2"></div>
                    
                    <button onclick="toggleScreenShare()" id="btn-screen" title="Share Screen"
                        class="w-12 h-12 rounded-xl flex items-center justify-center transition-all hover:-translate-y-1 hover:shadow-lg group relative overflow-hidden"
                        style="background:rgba(255,255,255,0.1); color:white;">
                        <i class="fas fa-desktop text-lg group-hover:scale-110 transition-transform"></i>
                    </button>

                    <button title="Toggle Chat Panel" onclick="document.getElementById('call-right-sidebar').classList.toggle('translate-x-full'); document.getElementById('call-right-sidebar').classList.toggle('w-0'); document.getElementById('call-right-sidebar').classList.toggle('w-80'); document.getElementById('call-right-sidebar').classList.toggle('opacity-0');"
                        class="w-12 h-12 rounded-xl flex items-center justify-center transition-all hover:-translate-y-1 hover:shadow-lg group relative"
                        style="background:rgba(255,255,255,0.1); color:#a5b4fc;">
                        <i class="fas fa-comment-alt text-lg group-hover:scale-110 transition-transform"></i>
                    </button>

                    <div class="w-px h-8 bg-white/10 mx-2"></div>
                    
                    <button onclick="endCall()" title="End Call"
                        class="px-6 py-3 h-12 rounded-xl flex items-center gap-2 font-black tracking-widest uppercase text-xs text-white transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-red-500/30 group"
                        style="background:linear-gradient(135deg,#dc2626,#ef4444);">
                        <i class="fas fa-phone-slash text-sm group-hover:rotate-12 transition-transform"></i> End
                    </button>
                </div>
            </div>
            
        </div>
        
        <!-- Right Sidebar (Integrated Chat) -->
        <div class="w-80 flex flex-col flex-shrink-0 absolute md:relative inset-y-0 right-0 z-50 transition-all duration-300 transform bg-[#11111a] border-l border-white/5" 
            id="call-right-sidebar">
            <div class="p-4 border-b border-white/10 flex items-center justify-between">
                <h3 class="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                    <i class="fas fa-comment-dots text-indigo-400"></i> Meeting Chat
                </h3>
                <i class="fas fa-times text-gray-500 hover:text-white cursor-pointer transition text-xs" 
                    onclick="document.getElementById('call-right-sidebar').classList.toggle('translate-x-full'); document.getElementById('call-right-sidebar').classList.toggle('w-0'); document.getElementById('call-right-sidebar').classList.toggle('w-80'); document.getElementById('call-right-sidebar').classList.toggle('opacity-0');"></i>
            </div>
            
            <div class="flex-1 p-3 overflow-y-auto custom-scrollbar flex flex-col gap-3" id="call-chat-history">
                <div class="text-center text-[10px] text-gray-500 italic my-2 p-2 bg-white/5 rounded-lg border border-white/5">
                    Welcome to the meeting chat. Messages sent here are visible to call participants.
                </div>
                <!-- Call Specific Chat injected here -->
            </div>
            
            <div class="p-3 border-t border-white/10 bg-black/20">
                <div class="flex items-center gap-2 bg-white/10 rounded-xl p-1 border border-white/10 focus-within:border-indigo-500/50 focus-within:bg-white/15 transition-all">
                    <button class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-indigo-400 hover:bg-white/10 transition shrink-0" title="Attach file">
                        <i class="fas fa-paperclip text-xs"></i>
                    </button>
                    <input type="text" id="call-chat-input" placeholder="Type a message..." class="flex-1 bg-transparent border-none text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-0 py-2">
                    <button class="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition shrink-0" 
                        onclick="sendCallChatMessage()">
                        <i class="fas fa-paper-plane text-xs"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(callWindow);

    // Incoming call modal
    const incModal = document.createElement('div');
    incModal.id = 'incoming-call-modal';
    incModal.className = 'hidden fixed inset-0 z-[9999] flex items-center justify-center p-4';
    incModal.style.cssText = 'background:rgba(15,15,40,0.85); backdrop-filter:blur(10px);';
    incModal.innerHTML = `
        < div class="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative animate-fade-in-up animate-bounce-in" >
            < !--Background pulse-- >
            <div class="absolute inset-0 opacity-10" style="background:radial-gradient(circle at 50% 0%, #4f46e5 0%, transparent 70%);"></div>
            
            <div class="p-8 pb-10 flex flex-col items-center text-center relative z-10">

                <div class="w-24 h-24 rounded-full flex items-center justify-center text-white text-4xl font-black mb-6 avatar-ring-anim" 
                    id="call-avatar-ring"
                    style="background:linear-gradient(135deg,#4f46e5,#7c3aed); border:4px solid white;">?</div>
                <h3 class="text-2xl font-black text-gray-800 mb-1 tracking-tight" id="incoming-caller-name">Caller Name</h3>
                <p class="text-sm font-semibold text-indigo-500 uppercase tracking-widest" id="incoming-call-type">Incoming Call...</p>
            </div>
            
            <div class="flex" style="border-top:1px solid #f3f4f6;">
                <button onclick="declineCall()" class="flex-1 py-5 flex items-center justify-center gap-2 group transition-colors"
                    style="background:#fef2f2; border-right:1px solid #f3f4f6;">
                    <span class="w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                        style="background:#ef4444; color:white; box-shadow:0 4px 12px rgba(239,68,68,0.3);">
                        <i class="fas fa-phone-slash"></i>
                    </span>
                    <span class="font-bold text-red-600">Decline</span>
                </button>
                <button onclick="acceptCall()" class="flex-1 py-5 flex items-center justify-center gap-2 group transition-colors"
                    style="background:#f0fdfa;">
                    <span class="w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                        style="background:#10b981; color:white; box-shadow:0 4px 12px rgba(16,185,129,0.3);">
                        <i id="accept-call-icon" class="fas fa-phone"></i>
                    </span>
                    <span class="font-bold text-emerald-600">Accept</span>
                </button>
            </div>
        </div >
        `;
    document.body.appendChild(incModal);

    // Image Upload Logic (Paste & Drag)
    window.addEventListener('paste', handleGlobalPaste);

    // Make PiP local video draggable instead of full screen window
    makeDraggable(document.getElementById('local-video-container'));
}

function makeDraggable(el, handle) {
    let ox = 0, oy = 0, mx = 0, my = 0;
    if (!handle) handle = el;
    handle.onmousedown = function (e) {
        e.preventDefault();
        ox = e.clientX; oy = e.clientY;
        document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
        document.onmousemove = function (e) {
            mx = ox - e.clientX; my = oy - e.clientY;
            ox = e.clientX; oy = e.clientY;
            el.style.top = (el.offsetTop - my) + "px";
            el.style.left = (el.offsetLeft - mx) + "px";
            el.style.right = 'auto'; el.style.bottom = 'auto';
        };
    };
}

function toggleContactsWidget() {
    const body = document.getElementById('zoho-contacts-body');
    const icon = document.getElementById('zoho-contacts-icon');
    if (body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        icon.style.transform = 'rotate(180deg)';
    } else {
        body.classList.add('hidden');
        icon.style.transform = 'rotate(0deg)';
    }
}

function handleSearch(e) {
    searchQuery = e.target.value.toLowerCase();
    renderContacts();
}

function switchTab(tab) {
    currentTab = tab;
    const allBtn = document.getElementById('tab-all');
    const onlineBtn = document.getElementById('tab-online');
    if (!allBtn || !onlineBtn) return;
    if (tab === 'all') {
        allBtn.style.cssText = 'flex:1; padding:8px; font-size:12px; font-weight:700; border-radius:50px; background:white; color:#4f46e5; box-shadow:0 2px 6px rgba(99,102,241,0.15); transition:all 0.2s;';
        onlineBtn.style.cssText = 'flex:1; padding:8px; font-size:12px; font-weight:600; border-radius:50px; background:transparent; color:#6b7280; display:flex; align-items:center; justify-content:center; gap:6px; transition:all 0.2s;';
    } else {
        onlineBtn.style.cssText = 'flex:1; padding:8px; font-size:12px; font-weight:700; border-radius:50px; background:white; color:#4f46e5; box-shadow:0 2px 6px rgba(99,102,241,0.15); display:flex; align-items:center; justify-content:center; gap:6px; transition:all 0.2s;';
        allBtn.style.cssText = 'flex:1; padding:8px; font-size:12px; font-weight:600; border-radius:50px; background:transparent; color:#6b7280; transition:all 0.2s;';
    }
    renderContacts();
}

function switchMainTab(tab) {
    ['chats', 'calls', 'video'].forEach(t => {
        const btn = document.getElementById(`main-tab-${t}`);
        if (!btn) return;
        if (t === tab) {
            btn.style.background = 'rgba(255,255,255,0.2)';
        } else {
            btn.style.background = 'transparent';
        }
    });
    // For now all tabs show the same contacts list (calls/video can be extended later)
    renderContacts();
}
window.switchMainTab = switchMainTab;



function updateContactsList(state) {
    lastPresenceState = state;
    renderContacts();
}

function renderContacts() {
    const list = document.getElementById('zoho-contact-list');
    const badge = document.getElementById('zoho-online-badge');
    if (!list) return;

    const onlineUserIds = new Set();
    if (lastPresenceState) {
        Object.keys(lastPresenceState).forEach(key => lastPresenceState[key].forEach(u => onlineUserIds.add(u.user_id)));
    }

    let combinedUsers = { ...allProfiles };
    if (lastPresenceState) {
        Object.keys(lastPresenceState).forEach(key => {
            lastPresenceState[key].forEach(u => {
                if (!combinedUsers[u.user_id]) combinedUsers[u.user_id] = { user_id: u.user_id, name: u.name, last_seen: new Date(), role: 'user' };
            });
        });
    }

    let users = Object.values(combinedUsers).filter(u => u.user_id !== currentUser?.id);
    users.sort((a, b) => {
        const aOn = onlineUserIds.has(a.user_id), bOn = onlineUserIds.has(b.user_id);
        if (aOn && !bOn) return -1;
        if (!aOn && bOn) return 1;
        return (a.name || '').localeCompare(b.name || '');
    });

    list.innerHTML = '';
    let totalOnline = 0;
    let totalUnread = 0;

    users.forEach(user => {
        const isOnline = onlineUserIds.has(user.user_id);
        if (isOnline) totalOnline++;
        if (currentTab === 'online' && !isOnline) return;
        if (searchQuery && !user.name?.toLowerCase().includes(searchQuery)) return;

        const isSelected = selectedUsersForGroup.has(user.user_id);
        const contextId = [currentUser?.id, user.user_id].sort().join('_');
        const unread = unreadCounts[contextId] || 0;
        totalUnread += unread;
        const avatarUrl = user.avatar_url;
        const isAdmin = user.role === 'admin';

        const avatarGradients = [
            'linear-gradient(135deg,#06b6d4,#6366f1)',
            'linear-gradient(135deg,#8b5cf6,#06b6d4)',
            'linear-gradient(135deg,#6366f1,#a78bfa)',
            'linear-gradient(135deg,#0ea5e9,#8b5cf6)',
            'linear-gradient(135deg,#14b8a6,#6366f1)',
        ];
        const gradIdx = (user.name || 'A').charCodeAt(0) % avatarGradients.length;
        const avatarGrad = avatarGradients[gradIdx];

        const li = document.createElement('li');
        li.style.cssText = `
    background:${isSelected ? '#ede9fe' : 'white'};
    border - radius: 12px;
    box - shadow: 0 1px 6px rgba(99, 102, 241, 0.08);
    padding: 7px 10px;
    display: flex;
    align - items: center;
    gap: 8px;
    cursor:default ;
    transition: box - shadow 0.15s, transform 0.1s;
    `;
        li.onmouseover = () => { li.style.boxShadow = '0 4px 14px rgba(99,102,241,0.15)'; li.style.transform = 'translateY(-1px)'; };
        li.onmouseout = () => { li.style.boxShadow = '0 1px 6px rgba(99,102,241,0.08)'; li.style.transform = 'translateY(0)'; };

        li.innerHTML = `
            <!-- Checkbox -->
            <div onclick="event.stopPropagation()">
                <input type="checkbox" class="w-3 h-3 rounded cursor-pointer focus:ring-0"
                    style="accent-color:#4f46e5;"
                    ${isSelected ? 'checked' : ''}
                    onchange="toggleZohoSelection(event, '${user.user_id}')">
            </div>

            <!--Avatar -->
            <div class="relative flex-shrink-0" onclick="openDockedChat({id:'${user.user_id}',name:'${user.name}',avatar_url:'${avatarUrl || ''}'},'private')" style="cursor:pointer;">
                ${avatarUrl
                ? `<img src="${avatarUrl}" class="w-9 h-9 rounded-full object-cover" style="border:2px solid #e0e7ff;" alt="${user.name}">`
                : `<div class="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-white select-none" style="background:${avatarGrad};">${(user.name || '?').charAt(0).toUpperCase()}</div>`
            }
                ${isOnline ? `<span class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full online-ring" style="background:#22c55e; border:2px solid white;"></span>` : ''}
            </div>

            <!-- Name + Status -->
            <div class="flex-1 min-w-0" onclick="openDockedChat({id:'${user.user_id}',name:'${user.name}',avatar_url:'${avatarUrl || ''}'},'private')" style="cursor:pointer;">
                <div class="flex items-center gap-1 flex-wrap">
                    <span class="text-xs font-black truncate" style="color:#1e1b4b;">${user.name}</span>
                    ${isAdmin ? `<span class="text-[7px] px-1 py-0.5 rounded-full font-black" style="background:#dbeafe; color:#2563eb; border:1px solid #bfdbfe;">ADMIN</span>` : ''}
                    ${unread > 0 ? `<span class="text-[8px] font-black px-1 py-0.5 rounded-full text-white" style="background:#ef4444;">${unread}</span>` : ''}
                </div>
                <p class="text-[10px] font-medium" style="color:${isOnline ? '#16a34a' : '#9ca3af'};">${isOnline ? 'Online' : 'Offline'}</p>
            </div>

            <!-- Quick Actions -->
        <div class="flex items-center gap-1 flex-shrink-0">
            <button onclick="event.stopPropagation(); openDockedChat({id:'${user.user_id}',name:'${user.name}',avatar_url:'${avatarUrl || ''}'},'private')"
                class="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110"
                style="background:#ede9fe;" title="Chat">
                <i class="fas fa-comment text-[10px]" style="color:#6366f1;"></i>
            </button>
            <button onclick="event.stopPropagation(); startCall('${contextId}','audio')"
                class="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110"
                style="background:#e0f2fe;" title="Audio Call">
                <i class="fas fa-phone text-[10px]" style="color:#0284c7;"></i>
            </button>
            <button onclick="event.stopPropagation(); startCall('${contextId}','video')"
                class="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110"
                style="background:#ede9fe;" title="Video Call">
                <i class="fas fa-video text-[10px]" style="color:#7c3aed;"></i>
            </button>
        </div>
    `;
        list.appendChild(li);
    });

    if (list.children.length === 0) {
        list.innerHTML = `<div class="flex flex-col items-center justify-center h-32 gap-2 text-gray-400"><i class="fas fa-user-slash text-2xl opacity-40"></i><span class="text-xs">No contacts found</span></div>`;
    }

    if (badge) { badge.innerText = totalOnline; totalOnline > 0 ? badge.classList.remove('hidden') : badge.classList.add('hidden'); }

    const unreadBadge = document.getElementById('zoho-unread-total');
    if (unreadBadge) { unreadBadge.innerText = totalUnread; totalUnread > 0 ? unreadBadge.classList.remove('hidden') : unreadBadge.classList.add('hidden'); }

    const groupBar = document.getElementById('group-action-bar');
    const selCount = document.getElementById('sel-count');
    if (selectedUsersForGroup.size > 0) { groupBar.classList.remove('hidden'); selCount.innerText = selectedUsersForGroup.size; }
    else groupBar.classList.add('hidden');
}

function toggleZohoSelection(e, userId) {
    if (e.target.checked) selectedUsersForGroup.add(userId);
    else selectedUsersForGroup.delete(userId);
    renderContacts();
}

function createGroupFromSelection() {
    if (selectedUsersForGroup.size === 0) return;
    const members = [...selectedUsersForGroup, currentUser.id];
    const groupId = members.sort().join('_');
    openDockedChat({ groupId, name: `Group(${members.length})`, members, isGroup: true }, 'group');
    selectedUsersForGroup.clear();
    renderContacts();
}

// --- DOCKED CHAT WINDOW ---

async function openDockedChat(target, type) {
    let contextId = type === 'global' ? 'global' : type === 'group' ? target.groupId : [currentUser.id, target.id].sort().join('_');

    if (openChats.has(contextId)) {
        document.getElementById(`input-${contextId}`)?.focus();
        return;
    }
    if (openChats.size >= 3) closeDockedChat(openChats.keys().next().value);

    openChats.set(contextId, { target, type });
    unreadCounts[contextId] = 0;
    renderContacts();

    const dockArea = document.getElementById('zoho-dock-area');
    const win = document.createElement('div');
    win.id = `chat-window-${contextId}`;
    win.className = 'flex flex-col pointer-events-auto animate-fade-in-up border border-white/10 rounded-t-xl shadow-2xl overflow-hidden';
    win.style.cssText = 'width:300px; height:400px; background: linear-gradient(145deg, #1e1b4b, #312e81);';

    const isPrivate = type === 'private';
    const avatarUrl = target.avatar_url || '';
    const avatarHtml = avatarUrl
        ? `<img src="${avatarUrl}" class="w-7 h-7 rounded-full object-cover border border-indigo-400">`
        : `<div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white" style="background:linear-gradient(135deg,#6366f1,#a78bfa)">${(target.name || '?').charAt(0).toUpperCase()}</div>`;

    win.innerHTML = `
        <!-- Chat header -->
        <div class="px-3 py-2 flex items-center justify-between select-none border-b border-white/10 cursor-pointer" onclick="toggleDockBody('${contextId}')">
            <div class="flex items-center gap-2 min-w-0">
                <div class="flex-shrink-0">${avatarHtml}</div>
                <div class="min-w-0">
                    <p class="text-xs font-bold text-white truncate">${target.name}</p>
                    <p id="status-${contextId}" class="text-[9px]" style="color:#818cf8;">...</p>
                </div>
            </div>
            <div class="flex items-center gap-3 flex-shrink-0">
                ${isPrivate ? `
                <i class="fas fa-phone text-xs cursor-pointer transition-all hover:scale-110" 
                    style="color:#a5b4fc;"
                    onmouseover="this.style.color='#4ade80'; this.style.textShadow='0 0 8px rgba(74,222,128,0.7)';" 
                    onmouseout="this.style.color='#a5b4fc'; this.style.textShadow='none';"
                    title="Audio Call" onclick="event.stopPropagation(); startCall('${contextId}','audio')"></i>
                <i class="fas fa-video text-xs cursor-pointer transition-all hover:scale-110"
                    style="color:#a5b4fc;"
                    onmouseover="this.style.color='#60a5fa'; this.style.textShadow='0 0 8px rgba(96,165,250,0.7)';" 
                    onmouseout="this.style.color='#a5b4fc'; this.style.textShadow='none';"
                    title="Video Call" onclick="event.stopPropagation(); startCall('${contextId}','video')"></i>
                ` : ''}
                <i class="fas fa-minus text-xs cursor-pointer transition-colors" style="color:#818cf8;"
                    onmouseover="this.style.color='white';" onmouseout="this.style.color='#818cf8';"
                    onclick="event.stopPropagation(); toggleDockBody('${contextId}')" title="Minimize"></i>
                <i class="fas fa-times text-xs cursor-pointer transition-all hover:scale-110" style="color:#818cf8;"
                    onmouseover="this.style.color='#f87171'; this.style.textShadow='0 0 6px rgba(248,113,113,0.6)';" 
                    onmouseout="this.style.color='#818cf8'; this.style.textShadow='none';"
                    onclick="closeDockedChat('${contextId}', event)" title="Close"></i>
            </div>
        </div>

        <!-- Chat body -->
        <div id="chat-body-${contextId}" class="flex flex-col flex-1 overflow-hidden" style="background:#f9fafb;">
            <!-- Drop zone -->
            <div id="drop-zone-${contextId}" class="absolute inset-0 flex flex-col items-center justify-center z-20 hidden m-2 rounded-xl pointer-events-none"
                style="background:rgba(99,102,241,0.08); border:2px dashed #c7d2fe;">
                <i class="fas fa-cloud-upload-alt text-3xl mb-2 text-indigo-400"></i>
                <span class="text-xs font-bold text-indigo-500">Drop to share</span>
            </div>

            <!-- Messages -->
            <div id="msg-container-${contextId}" class="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar text-xs">
                <div class="text-center text-[10px] my-2 italic flex items-center gap-2 justify-center text-gray-400">
                    <div class="flex-1 h-px bg-gray-200"></div>
                    <span>Loading messages...</span>
                    <div class="flex-1 h-px bg-gray-200"></div>
                </div>
            </div>

            <!-- Typing indicator -->
            <div id="typing-${contextId}" class="hidden px-3 py-1.5 text-[10px] italic flex items-center gap-1 text-indigo-500">
                <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
                <span id="typing-name-${contextId}" class="ml-1.5">typing...</span>
            </div>

            <!-- Input bar -->
            <div class="p-2 flex items-center gap-1.5" style="border-top:1px solid #e5e7eb; background:white;">
                <button class="p-1.5 rounded-lg transition-all hover:scale-110 flex-shrink-0 text-gray-400"
                    onmouseover="this.style.background='#ede9fe'; this.style.color='#4f46e5';"
                    onmouseout="this.style.background='transparent'; this.style.color='#9ca3af';"
                    onclick="document.getElementById('file-input-${contextId}').click()" title="Attach">
                    <i class="fas fa-paperclip text-xs"></i>
                </button>
                <input type="file" id="file-input-${contextId}" class="hidden" onchange="handleFileUpload(event, '${contextId}')">
                    <button class="p-1.5 rounded-lg transition-all hover:scale-110 flex-shrink-0 text-gray-400"
                        onmouseover="this.style.background='#ede9fe'; this.style.color='#4f46e5';"
                        onmouseout="this.style.background='transparent'; this.style.color='#9ca3af';"
                        onclick="toggleEmojiPicker('${contextId}')" title="Emoji">
                        <i class="fas fa-face-smile text-xs"></i>
                    </button>
                    <input id="input-${contextId}" type="text"
                        class="flex-1 text-sm px-3 py-1.5 rounded-xl focus:outline-none transition-all text-gray-800"
                        style="background:#f3f4f6; border:1px solid #e5e7eb; caret-color:#4f46e5;"
                        onfocus="this.style.borderColor='#6366f1'; this.style.boxShadow='0 0 0 2px rgba(99,102,241,0.15)';"
                        onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none';"
                        placeholder="Message..."
                        onkeypress="handleDockKey(event, '${contextId}')"
                        oninput="broadcastTyping('${contextId}')">
                        <button class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-110"
                            style="background:linear-gradient(135deg,#4f46e5,#7c3aed); box-shadow:0 2px 8px rgba(79,70,229,0.35);"
                            onclick="sendDockMessage('${contextId}')">
                            <i class="fas fa-paper-plane text-xs text-white"></i>
                        </button>
                    </div>

                    <!-- Emoji picker -->
                    <div id="emoji-picker-${contextId}" class="hidden flex-wrap gap-1 p-2" style="background:white; border-top:1px solid #f3f4f6;">
                        ${['😀', '😂', '❤️', '👍', '🔥', '😮', '😢', '🎉', '👏', '🙏', '😍', '🤔', '😎', '💯', '✅'].map(e => `<button class="text-lg hover:scale-125 transition-transform rounded-lg p-0.5" onclick="insertEmoji('${contextId}','${e}')">${e}</button>`).join('')}
                    </div>
            </div>
            `;

    dockArea.appendChild(win);

    // Drag & drop
    const body = win.querySelector(`#chat-body-${contextId}`);
    const dropZone = win.querySelector(`#drop-zone-${contextId}`);
    win.addEventListener('dragenter', e => { e.preventDefault(); dropZone.classList.remove('hidden'); });
    win.addEventListener('dragleave', e => { if (!win.contains(e.relatedTarget)) dropZone.classList.add('hidden'); });
    win.addEventListener('dragover', e => e.preventDefault());
    win.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.add('hidden'); if (e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0], contextId); });

    setTimeout(() => document.getElementById(`input-${contextId}`)?.focus(), 100);

    // Load message history
    await loadMessageHistory(contextId);

    // Mark unread as read immediately upon opening
    await markMessagesAsRead(contextId);

    // Subscribe to typing events for this chat
    if (type === 'private' && target.id) {
        subscribeToTyping(contextId, target.id);
    }
}

function toggleDockBody(contextId) {
    const body = document.getElementById(`chat-body-${contextId}`);
    const win = document.getElementById(`chat-window-${contextId}`);
    if (!body || !win) return;
    if (body.classList.contains('hidden')) { body.classList.remove('hidden'); win.style.height = '400px'; }
    else { body.classList.add('hidden'); win.style.height = '44px'; }
}
window.toggleDockBody = toggleDockBody;

function closeDockedChat(contextId, e) {
    if (e) e.stopPropagation();
    document.getElementById(`chat-window-${contextId}`)?.remove();
    openChats.delete(contextId);
}
window.closeDockedChat = closeDockedChat;

window.handleDockKey = function (e, contextId) {
    if (e.key === 'Enter') sendDockMessage(contextId);
    markMessagesAsRead(contextId); // Updates read status when they start typing
};

function toggleEmojiPicker(contextId) {
    const picker = document.getElementById(`emoji-picker-${contextId}`);
    picker.classList.toggle('hidden');
}

function insertEmoji(contextId, emoji) {
    const input = document.getElementById(`input-${contextId}`);
    if (input) { input.value += emoji; input.focus(); }
}

// --- MESSAGE PERSISTENCE ---

async function loadMessageHistory(contextId) {
    const container = document.getElementById(`msg-container-${contextId}`);
    if (!container) return;

    try {
        const { data, error } = await sbClient
            .from('messages')
            .select('*')
            .eq('context_id', contextId)
            .order('created_at', { ascending: true })
            .limit(30);

        container.innerHTML = `<div class="text-center text-indigo-400/60 text-[10px] my-2 italic flex items-center gap-2 justify-center"><div class="flex-1 h-px bg-indigo-900/40"></div><span>Start of conversation</span><div class="flex-1 h-px bg-indigo-900/40"></div></div>`;

        if (data && data.length > 0) {
            for (const msg of data) {
                let text = '';
                if (msg.cipher) {
                    try { text = await CryptoUtils.decrypt(msg.cipher, contextId); } catch { text = '[Encrypted]'; }
                }
                const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                appendMessageToWindow(contextId, {
                    userId: msg.sender_id,
                    user: msg.sender_name,
                    text,
                    time,
                    attachment: msg.file_url ? { type: msg.message_type, url: msg.file_url, name: msg.file_name } : null,
                    messageId: msg.id,
                    status: msg.status
                });
            }
        }
    } catch (e) {
        console.warn('Could not load message history:', e);
        const container = document.getElementById(`msg-container-${contextId}`);
        if (container) container.innerHTML = `<div class="text-center text-indigo-400/60 text-[10px] my-2 italic">Could not load history</div>`;
    }
}

async function saveMessageToDB(contextId, payload, text) {
    try {
        const { data: { user } } = await sbClient.auth.getUser();
        if (!user) return;

        const cipher = payload.cipher || (text ? await CryptoUtils.encrypt(text, contextId) : null);

        await sbClient.from('messages').insert({
            context_id: contextId,
            sender_id: user.id,
            sender_name: payload.user || payload.sender_name,
            cipher,
            message_type: payload.attachment ? (payload.attachment.type.startsWith('image/') ? 'image' : 'file') : 'text',
            file_url: payload.attachment?.url || null,
            status: 'sent'
        });
    } catch (e) {
        console.warn("Error saving message", e);
    }
}

async function markMessagesAsRead(contextId) {
    if (!contextId) return;
    try {
        const { data: { user } } = await sbClient.auth.getUser();
        if (!user) return;

        // Update all unread messages sent by others in this context to 'read'
        await sbClient.from('messages')
            .update({ status: 'read' })
            .eq('context_id', contextId)
            .neq('sender_id', user.id)
            .neq('status', 'read');

        // Optional: Notify peers via realtime room if you aren't listening to DB changes directly
        const chatData = openChats.get(contextId);
        if (chatData && chatData.target?.id) {
            const ch = await getPeerChannel(chatData.target.id);
            ch.send({ type: 'broadcast', event: 'messages-read', payload: { contextId, readerId: user.id } });
        }
    } catch (e) {
        console.warn("Could not mark as read", e);
    }
}

// --- TYPING INDICATOR ---

async function broadcastTyping(contextId) {
    const chatData = openChats.get(contextId);
    if (!chatData || chatData.type !== 'private') return;
    const { target } = chatData;
    const displayName = currentUser.user_metadata?.display_name || currentUser.email?.split('@')[0] || 'Someone';

    const ch = await getPeerChannel(target.id);
    ch.send({ type: 'broadcast', event: 'typing', payload: { senderId: currentUser.id, name: displayName, contextId } });
}

function subscribeToTyping(contextId) {
    // privateChannel already handles incoming typing events
    // handled in initRealtimeFeatures
}

function showTypingIndicator(contextId, name) {
    const el = document.getElementById(`typing-${contextId}`);
    const nameEl = document.getElementById(`typing-name-${contextId}`);
    if (!el) return;
    if (nameEl) nameEl.textContent = `${name} is typing...`;
    el.classList.remove('hidden');
    clearTimeout(typingTimers[contextId]);
    typingTimers[contextId] = setTimeout(() => el.classList.add('hidden'), 2500);
}

// --- SEND MESSAGE ---

const peerChannels = new Map();
function getPeerChannel(rid) {
    return new Promise((resolve) => {
        if (peerChannels.has(rid)) {
            resolve(peerChannels.get(rid));
            return;
        }
        const ch = sbClient.channel(`room-private-${rid}`);
        ch.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                peerChannels.set(rid, ch);
                resolve(ch);
            }
        });
    });
}

async function sendDockMessage(contextId, attachment = null) {
    const input = document.getElementById(`input-${contextId}`);
    const text = input ? input.value.trim() : '';
    if (!text && !attachment) return;

    const chatData = openChats.get(contextId);
    if (!chatData) return;
    const { target, type } = chatData;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const displayName = currentUser.user_metadata?.display_name || currentUser.email?.split('@')[0] || 'User';

    let payload = {
        user: displayName,
        userId: currentUser.id,
        senderId: currentUser.id,
        time,
        attachment
    };

    if (text) {
        const cipher = await CryptoUtils.encrypt(text, contextId);
        payload.cipher = cipher;
    }

    payload.isPrivate = type !== 'global';
    if (payload.isPrivate && type === 'group') payload.groupId = contextId;

    // Broadcast realtime
    if (type === 'global') {
        globalChannel.send({ type: 'broadcast', event: 'chat', payload });
    } else {
        const recipients = type === 'group' ? target.members : [target.id];
        recipients.forEach(async (rid) => {
            if (rid === currentUser.id) return;
            const ch = await getPeerChannel(rid);
            ch.send({ type: 'broadcast', event: 'dm', payload });
        });
    }

    // Save to DB
    try {
        await sbClient.from('messages').insert([{
            context_id: contextId,
            sender_id: currentUser.id,
            sender_name: displayName,
            cipher: payload.cipher || null, // null if plaintext
            message_type: attachment ? (attachment.type.startsWith('image/') ? 'image' : 'file') : 'text',
            file_url: attachment?.url || null,
            status: 'sent'
        }]);
    } catch (dbErr) {
        console.warn('DB Save Error (table might not exist yet):', dbErr);
    }

    appendMessageToWindow(contextId, { ...payload, text, isDetails: true });
    if (input) input.value = '';

    // Close emoji picker if open
    document.getElementById(`emoji-picker-${contextId}`)?.classList.add('hidden');
}

// --- HELPER: XSS SANITIZATION ---
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// --- RENDER MESSAGE BUBBLE ---

function appendMessageToWindow(contextId, msg) {
    const container = document.getElementById(`msg-container-${contextId}`);
    if (!container) return;

    if (msg.isSystem) {
        const div = document.createElement('div');
        div.id = msg.id || '';
        div.className = 'text-center text-xs text-indigo-400/60 my-1 italic';
        div.innerHTML = msg.text;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        return;
    }

    const isMe = msg.userId === currentUser?.id || msg.senderId === currentUser?.id;
    const div = document.createElement('div');
    div.className = `flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in-up`;

    let contentHtml = '';
    if (msg.attachment) {
        if (msg.attachment.type === 'image') {
            contentHtml = `<img src="${msg.attachment.url}" class="max-w-[180px] max-h-[130px] rounded-xl border border-white/10 cursor-pointer shadow-md hover:scale-105 transition-transform mb-1" onclick="openLightbox('${msg.attachment.url}', 'image')">`;
        } else {
            contentHtml = `<div class="flex items-center gap-2 bg-white/5 rounded-lg p-2 mb-1 max-w-[180px] border border-white/10"><i class="fas fa-file-alt text-indigo-300"></i><a href="${msg.attachment.url}" target="_blank" class="text-xs text-blue-300 hover:underline truncate flex-1">${msg.attachment.name}</a></div>`;
        }
    }
    if (msg.text) contentHtml += `<div class="break-words leading-snug">${escapeHTML(msg.text)}</div>`;

    const bubbleBg = isMe
        ? 'background: linear-gradient(135deg,#6366f1,#8b5cf6); color:white;'
        : 'background:white; color:#1f2937; border: 1px solid #e5e7eb; box-shadow: 0 1px 2px rgba(0,0,0,0.05);';

    const messageId = msg.messageId || ('msg_' + Date.now());

    let statusHtml = '';
    if (isMe) {
        if (msg.status === 'read') statusHtml = '<i class="fas fa-check-double text-[8px] text-blue-300"></i>';
        else if (msg.status === 'delivered') statusHtml = '<i class="fas fa-check-double text-[8px] opacity-75 text-white"></i>';
        else statusHtml = '<i class="fas fa-check text-[8px] opacity-50 text-white"></i>'; // Default sent
    }

    div.innerHTML = `
            <div class="max-w-[80%] relative msg-bubble group">
                ${!isMe && msg.groupId ? `<p class="text-[9px] font-bold text-indigo-300 mb-0.5 ml-1">${msg.user}</p>` : ''}
                <div id="${messageId}" style="${bubbleBg}" class="px-3 py-2 rounded-2xl ${isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'} shadow-md">
                    ${contentHtml}
                    <div class="flex items-center justify-end gap-1 mt-0.5">
                        <span class="text-[9px] opacity-50 select-none">${msg.time}</span>
                        ${statusHtml}
                    </div>
                </div>
                <!--Emoji reaction bar-->
                <div class="emoji-bar flex gap-0.5 ${isMe ? 'justify-end' : 'justify-start'} mt-0.5 opacity-0 translate-y-1 pointer-events-auto">
                    ${['👍', '❤️', '😂', '😮', '🔥'].map(e => `<button class="text-sm hover:scale-125 transition-transform bg-indigo-900/60 rounded-full w-6 h-6 flex items-center justify-center text-xs" onclick="sendReaction('${messageId}','${e}')">${e}</button>`).join('')}
                </div>
                <div id="reactions-${messageId}" class="flex gap-1 flex-wrap mt-0.5 ${isMe ? 'justify-end' : 'justify-start'}"></div>
            </div>
            `;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

async function sendReaction(messageId, emoji) {
    try {
        const { data: { user } } = await sbClient.auth.getUser();
        if (!user) return;
        await sbClient.from('message_reactions').upsert({ message_id: messageId, user_id: user.id, emoji }, { onConflict: 'message_id,user_id,emoji' });

        const el = document.getElementById(`reactions-${messageId}`);
        if (el) el.innerHTML += `<span class="text-sm bg-indigo-900/60 rounded-full px-1.5 py-0.5 text-xs">${emoji}</span>`;

        // Broadcast to peers
        const chatData = [...openChats.values()].find(c => c.target && (c.type === 'global' || c.target.id || c.target.groupId));
        if (chatData) {
            const contextId = [...openChats.entries()].find(([k, v]) => v === chatData)?.[0];

            if (chatData.type !== 'global') {
                const ch = await getPeerChannel(chatData.target.id);
                ch.send({ type: 'broadcast', event: 'reaction-added', payload: { messageId, emoji, contextId } });
            } else {
                globalChannel.send({ type: 'broadcast', event: 'reaction-added', payload: { messageId, emoji, contextId } });
            }
        }
    } catch (e) {
        console.warn('Reaction failed:', e);
    }
}

// --- IN-CHAT FILE/IMAGE PREVIEWS (LIGHTBOX) ---

function openLightbox(url, type) {
    let overlay = document.getElementById('lightbox-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'lightbox-overlay';
        overlay.className = 'fixed inset-0 z-[99999] bg-black/90 backdrop-blur-sm flex items-center justify-center animate-fade-in-up';
        overlay.onclick = (e) => { if (e.target === overlay) document.body.removeChild(overlay); };
        document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
        <button class="absolute top-6 right-6 text-white hover:text-red-400 transition-colors z-50 p-2" onclick="document.body.removeChild(document.getElementById('lightbox-overlay'))">
            <i class="fas fa-times text-2xl"></i>
        </button>
        <div class="relative max-w-5xl max-h-[85vh] w-full mx-4 flex flex-col items-center justify-center">
            ${type === 'image'
            ? `<img src="${url}" class="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl transition-transform duration-300 hover:scale-[1.02]">`
            : `<div class="bg-gray-800 p-8 rounded-2xl flex flex-col items-center gap-4 text-white">
                     <i class="fas fa-file-alt text-6xl text-indigo-400"></i>
                     <p class="font-bold tracking-wide text-lg text-center">Cannot preview this file type</p>
                     <a href="${url}" target="_blank" class="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold text-sm shadow-lg transition-colors">Download File</a>
                   </div>`
        }
        </div>
    `;
}

// --- FILE UPLOAD ---

function handleGlobalPaste(e) {
    const activeEl = document.activeElement;
    if (activeEl?.id?.startsWith('input-')) {
        const contextId = activeEl.id.replace('input-', '');
        const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items || [];
        for (const item of items) {
            if (item.kind === 'file') uploadFile(item.getAsFile(), contextId);
        }
    }
}

async function handleFileUpload(e, contextId) {
    if (e.target.files.length > 0) { await uploadFile(e.target.files[0], contextId); e.target.value = ''; }
}

async function uploadFile(file, contextId) {
    if (file.size > 10 * 1024 * 1024) { showToast('File too large! Max 10MB.', 'error'); return; }
    const tempId = 'upload-' + Date.now();
    appendMessageToWindow(contextId, { userId: currentUser.id, text: `< i class="fas fa-spinner fa-spin mr-1" ></i > Uploading ${file.name}...`, time: 'Now', isSystem: true, id: tempId });
    try {
        const fileName = `${currentUser.id}/${Date.now()}.${file.name.split('.').pop()}`;
        const { error } = await sbClient.storage.from('chat-attachments').upload(fileName, file);
        if (error) throw error;
        const { data: { publicUrl } } = sbClient.storage.from('chat-attachments').getPublicUrl(fileName);
        document.getElementById(tempId)?.remove();
        await sendDockMessage(contextId, { type: file.type.startsWith('image/') ? 'image' : 'file', url: publicUrl, name: file.name });
    } catch (err) {
        const el = document.getElementById(tempId);
        if (el) el.innerHTML = `<span class="text-red-400">Upload failed: ${err.message}</span>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof sbClient !== 'undefined') initRealtimeFeatures();
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


