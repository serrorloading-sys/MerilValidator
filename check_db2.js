const url = 'https://etdqyrkihsbritcikpbi.supabase.co/rest/v1/global_config?select=key';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0ZHF5cmtpaHNicml0Y2lrcGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NTMxNzksImV4cCI6MjA4NjAyOTE3OX0.gNVhroMQpc_2Yl3p8UyjdalTqzeUHvLgjcu-XxBWI1I';

fetch(url, {
    headers: {
        'apikey': anonKey,
        'Authorization': 'Bearer ' + anonKey
    }
})
    .then(r => r.json())
    .then(data => {
        console.log('Available keys in global_config:', data);
    })
    .catch(console.error);
