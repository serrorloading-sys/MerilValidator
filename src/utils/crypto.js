// --- src/utils/crypto.js ---

const MASTER_SALT = 'MERIL_CHAT_V1_SALT_SUPER_SECRET';

window.CryptoUtils = {
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
            enc.encode(encodeURIComponent(text)) // Safe unicode encoding
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
            const decodedStr = dec.decode(decrypted);
            try {
                return decodeURIComponent(decodedStr);
            } catch (uriErr) {
                // Fallback for legacy messages that didn't use URI encoding
                return decodedStr;
            }
        } catch (e) {
            console.error("Decryption failed", e);
            return "[Encrypted Message]";
        }
    }
};
