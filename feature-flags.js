
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
