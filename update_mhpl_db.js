const SUPABASE_URL = 'https://etdqyrkihsbritcikpbi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0ZHF5cmtpaHNicml0Y2lrcGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NTMxNzksImV4cCI6MjA4NjAyOTE3OX0.gNVhroMQpc_2Yl3p8UyjdalTqzeUHvLgjcu-XxBWI1I';

const headers = [
    "Material",
    "Material Group",
    "Division",
    "EAN/UPC",
    "Weight unit",
    "Gross Weight",
    "Net Weight",
    "Material Description",
    "Material type descr.",
    "Material Group Desc.",
    "Material grp desc. 2",
    "Name",
    "PH Level 01",
    "PH Level 01 - Desc.",
    "PH Level 02",
    "PH Level 02 - Desc.",
    "PH Level 03",
    "PH Level 03 - Desc.",
    "PH Level 04",
    "PH Level 04 - Desc.",
    "PH Level 05",
    "PH Level 05 - Desc."
];

// Combine into CSV line
const csvHeaderLine = headers.map(h => `"${h}"`).join(',');

// We will fetch the current global_config for mhpl_settings
const url = `${SUPABASE_URL}/rest/v1/global_config?key=eq.mhpl_settings`;

async function updateDb() {
    try {
        // 1. Fetch current
        const res = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        const data = await res.json();

        if (!data || data.length === 0) {
            console.error("No mhpl_settings found.");
            return;
        }

        let configObj = data[0].value || {};

        // 2. We preserve configObj, and replace material_master_csv 
        // We will just put the headers line for now to initialize it properly.
        // Wait, if the user has a file, maybe we should just create an empty template 
        // and let them upload their data from Admin Panel?
        // Or we can just set the headers line.
        configObj.material_master_csv = csvHeaderLine;

        // 3. Update DB
        const patchRes = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ value: configObj })
        });

        if (patchRes.ok) {
            console.log("Successfully updated mhpl_settings with new Master Headers!");
            console.log("Headers set:", csvHeaderLine);
        } else {
            console.error("Update failed:", await patchRes.text());
        }

    } catch (err) {
        console.error("Error:", err);
    }
}

updateDb();
