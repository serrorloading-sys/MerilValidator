
/**
 * feature-flags.js
 * Handles visibility of UI elements based on Admin Configuration.
 * 
 * Usage:
 * 1. Include this script in text/html file.
 * 2. Add `data-feature="feature_name"` to HTML elements.
 * 3. Call `initFeatureFlags('tool_key')` on load.
 */

async function initFeatureFlags(toolKey) {
    if (typeof sbClient === 'undefined') {
        console.error("Supabase client not found. Feature flags disabled.");
        return;
    }

    console.log(`[FeatureFlags] Initializing for ${toolKey}...`);

    try {
        const { data, error } = await sbClient
            .from('global_config')
            .select('value')
            .eq('key', toolKey)
            .single();

        if (error || !data || !data.value || !data.value.features) {
            console.warn(`[FeatureFlags] No config or features found for ${toolKey}. Defaulting to enabled.`);
            return;
        }

        const features = data.value.features;
        console.log("[FeatureFlags] Loaded settings:", features);

        applyFeatureFlags(features);

    } catch (e) {
        console.error("[FeatureFlags] Error loading settings:", e);
    }
}

function applyFeatureFlags(features) {
    Object.keys(features).forEach(featureKey => {
        const isEnabled = features[featureKey];
        const elements = document.querySelectorAll(`[data-feature="${featureKey}"]`);

        elements.forEach(el => {
            if (isEnabled) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });
    });
}

/**
 * Updates a specific feature flag or config setting in global_config.
 * @param {string} toolKey - The key in global_config (e.g., 'mlsipl_settings')
 * @param {object} partialUpdate - Object containing keys to update (e.g., { material_master_csv: "..." })
 */
async function updateFeatureFlag(toolKey, partialUpdate) {
    if (typeof sbClient === 'undefined') {
        console.error("Supabase client not found.");
        return { error: "Supabase client not found" };
    }

    try {
        // 1. Fetch current config
        const { data, error } = await sbClient
            .from('global_config')
            .select('*')
            .eq('key', toolKey)
            .single();

        if (error) throw error;

        let currentConfig = data.value || {};

        // 2. Merge changes
        // Deep merge for 'features' if provided, otherwise top-level merge
        const newConfig = { ...currentConfig, ...partialUpdate };

        // 3. Update
        const { error: updateError } = await sbClient
            .from('global_config')
            .update({
                value: newConfig,
                updated_at: new Date().toISOString(),
                // updated_by: sbClient.auth.user().id // Handled by RLS/Trigger usually, or add if schema requires
            })
            .eq('key', toolKey);

        if (updateError) throw updateError;

        console.log(`[FeatureFlags] Updated ${toolKey} successfully.`);
        return { success: true };

    } catch (e) {
        console.error("[FeatureFlags] Update Error:", e);
        return { error: e.message };
    }
}
