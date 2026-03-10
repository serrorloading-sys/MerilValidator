const fs = require('fs');
let largeStr = "Material,Desc\n".repeat(30000); // 30k rows ~ 400KB
let payload = JSON.stringify({ material_master_csv: largeStr });
console.log("Payload length:", payload.length);
