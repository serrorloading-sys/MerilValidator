const url = 'https://etdqyrkihsbritcikpbi.supabase.co/rest/v1/global_config?key=eq.mhpl_settings';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0ZHF5cmtpaHNicml0Y2lrcGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NTMxNzksImV4cCI6MjA4NjAyOTE3OX0.gNVhroMQpc_2Yl3p8UyjdalTqzeUHvLgjcu-XxBWI1I';

fetch(url, {
    headers: {
        'apikey': anonKey,
        'Authorization': 'Bearer ' + anonKey
    }
})
    .then(r => r.json())
    .then(data => {
        if (data && data.length > 0) {
            const csv = data[0].value.material_master_csv;
            if (csv) {
                console.log('CSV data found. Length:', csv.length);
                const lines = csv.split('\n');
                console.log('Total Lines:', lines.length);
                console.log('First 5 lines:');
                for (let i = 0; i < Math.min(5, lines.length); i++) {
                    console.log(lines[i]);
                }
                // Check for HDAA-32
                const match = lines.find(l => l.includes('HDAA-32'));
                console.log('\nSearch for HDAA-32:', match || 'Not Found');
            } else {
                console.log('No CSV found in mhpl_settings.');
            }
        } else {
            console.log('No mhpl_settings found.');
        }
    })
    .catch(console.error);
