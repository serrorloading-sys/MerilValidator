
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
