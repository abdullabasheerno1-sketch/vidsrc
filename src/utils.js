import CryptoJS from "crypto-js";

export function decryptSourceUrl(encUrl) {
    let baseHex = CryptoJS.enc.Base64.parse(encUrl).toString(CryptoJS.enc.Hex);
    let key = "38892d3d63372f4d6d6b6f6d4b6f6f4d";
    let iv = "63372f4d6d6b6f6d";

    let decrypted = CryptoJS.AES.decrypt(
        { ciphertext: CryptoJS.enc.Hex.parse(baseHex) },
        CryptoJS.enc.Hex.parse(key),
        {
            iv: CryptoJS.enc.Hex.parse(iv),
            mode: CryptoJS.EncryptedMode?.CBC || CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        }
    );

    return decrypted.toString(CryptoJS.enc.Utf8);
}

export async function encodeId(id) {
    try {
        const res = await fetch(`https://raw.githubusercontent.com/Bengoros/Vidsrc-Keys/main/keys.json`);
        const keys = await res.json();
        
        let key = keys[0];
        let encrypted = CryptoJS.AES.encrypt(id, key, {
            iv: CryptoJS.enc.Utf8.parse(key.substring(0, 16)),
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
        
        return encodeURIComponent(encrypted.toString());
    } catch (err) {
        return id;
    }
}

export async function getFutoken(key, referer) {
    try {
        const res = await fetch(`https://pony-three.vercel.app/futoken`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Referer': referer
            },
            body: JSON.stringify({ key })
        });
        const data = await res.json();
        return data.token || key;
    } catch (err) {
        return key;
    }
}
