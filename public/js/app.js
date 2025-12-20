console.log("🔐 Secure Notes App Initializing...");

// ==================== FIREBASE CONFIGURATION ====================
const firebaseConfig = {
    apiKey: "AIzaSyAxT9BXgiLuw4BkPzmlMv-pc9GMCO_miVM",
    authDomain: "client-side-aes-encryption.firebaseapp.com",
    projectId: "client-side-aes-encryption",
    storageBucket: "client-side-aes-encryption.firebasestorage.app",
    messagingSenderId: "1038006574860",
    appId: "1:1038006574860:web:6c29bbdf233f6ca94f3329",
    measurementId: "G-SH8YLFQNZY"
};

// ==================== GLOBAL VARIABLES ====================
let currentKey = null;
let firebaseApp = null;
let firebaseDb = null;
let noteCounter = 0;
let savedNotes = JSON.parse(localStorage.getItem('savedNotes') || '[]');

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log("📄 DOM fully loaded");
    initializeFirebase();
    updateNoteCounter();
    refreshStats();

    setTimeout(() => {
        showStatus("Welcome to Secure Notes App! Start by creating a note.", "info");
    }, 1000);
});

// ==================== FIREBASE FUNCTIONS ====================
function initializeFirebase() {
    try {
        if (!firebaseApp) {
            firebaseApp = firebase.initializeApp(firebaseConfig);
            firebaseDb = firebase.firestore(firebaseApp);
            console.log("✅ Firebase initialized successfully!");
            updateStatus("Firebase Connected", true);
            return true;
        }
        return true;
    } catch (error) {
        console.error("❌ Firebase initialization failed:", error);
        updateStatus("Firebase Error: " + error.message, false);
        return false;
    }
}

// ==================== UTILITY FUNCTIONS ====================
function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('status');
    if (statusDiv) {
        statusDiv.innerHTML = `<div class="${type}">${message}</div>`;
        if (type === 'info' && message.includes("Generating AES key")) {
            statusDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
    console.log(`[${type.toUpperCase()}] ${message}`);
    document.getElementById('lastOp').textContent = message.substring(0, 50) + (message.length > 50 ? '...' : '');
    if (type === 'success') {
        setTimeout(() => {
            if (statusDiv && statusDiv.innerHTML.includes(message)) {
                statusDiv.innerHTML = '';
            }
        }, 5000);
    }
}

function showDecryptStatus(message, type = 'info') {
    const decryptStatusDiv = document.getElementById('decryptStatus');
    if (decryptStatusDiv) {
        decryptStatusDiv.innerHTML = `<div class="${type}">${message}</div>`;
        console.log(`[DECRYPT ${type.toUpperCase()}] ${message}`);
        if (type === 'success') {
            setTimeout(() => {
                if (decryptStatusDiv && decryptStatusDiv.innerHTML.includes(message)) {
                    decryptStatusDiv.innerHTML = '';
                }
            }, 5000);
        }
    }
}

function updateStatus(message, isSuccess = true) {
    const debugStatus = document.getElementById('debugStatus');
    if (debugStatus) {
        debugStatus.textContent = message;
        debugStatus.style.color = isSuccess ? '#27ae60' : '#e74c3c';
    }
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

function showDecryptLoading(show) {
    document.getElementById('decryptLoading').style.display = show ? 'block' : 'none';
}

// ==================== AES-256 BASE64 KEY ====================
function generateAESKeyBase64() {
    const keyBytes = crypto.getRandomValues(new Uint8Array(32));
    const wordArray = CryptoJS.lib.WordArray.create(keyBytes);
    return CryptoJS.enc.Base64.stringify(wordArray);
}

// ==================== NOTE MANAGEMENT ====================
async function addNote() {
    console.log("🟢 addNote() called");

    const noteName = document.getElementById('noteName').value.trim();
    const username = document.getElementById('username').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const noteText = document.getElementById('noteText').value.trim();

    if (!noteName || !noteText) {
        showStatus("❌ Please fill in note name and content", "error");
        return;
    }

    if (noteName.length > 100) {
        showStatus("❌ Note name too long (max 100 characters)", "error");
        return;
    }

    if (noteText.length > 5000) {
        showStatus("❌ Note content too long (max 5000 characters)", "error");
        return;
    }

    showLoading(true);
    showStatus("Generating AES key and encrypting data...", "info");

    try {
        // Generate Base64 key
        currentKey = generateAESKeyBase64();

        // Convert Base64 key to WordArray
        const keyWA = CryptoJS.enc.Base64.parse(currentKey);
        const iv = CryptoJS.lib.WordArray.random(16);

        const noteData = {
            noteName: noteName,
            username: username || 'Anonymous',
            phone: phone || 'Not provided',
            noteText: noteText,
            timestamp: new Date().toISOString(),
            id: Date.now().toString()
        };

        // Encrypt with AES-256-CBC
        const encrypted = CryptoJS.AES.encrypt(
            JSON.stringify(noteData),
            keyWA,
            { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
        );

        const encryptedPayload = {
            ciphertext: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
            iv: iv.toString(CryptoJS.enc.Base64)
        };

        if (!initializeFirebase()) throw new Error("Firebase not available");

        showStatus("Saving encrypted note to Firebase...", "info");

        const firestoreData = {
            encryptedNote: encryptedPayload,
            noteName: noteName,
            timestamp: new Date().toISOString(),
            createdAt: new Date().toLocaleString(),
            keyHint: `Key ID: ${currentKey.substring(0, 8)}...`,
            noteLength: noteText.length,
            isEncrypted: true
        };

        const docRef = await firebaseDb.collection("notes").add(firestoreData);
        console.log("✅ Document saved with ID:", docRef.id);

        const localNote = { ...noteData, firebaseId: docRef.id, aesKey: currentKey, savedAt: new Date().toISOString() };
        savedNotes.push(localNote);
        localStorage.setItem('savedNotes', JSON.stringify(savedNotes));

        noteCounter++;
        updateNoteCounter();

        showStatus(`✅ Note "${noteName}" saved successfully!`, "success");
        displayKeyToUser(noteName, currentKey, docRef.id);

        clearForm();
        refreshStats();

    } catch (error) {
        console.error("❌ Error saving note:", error);
        showStatus(`❌ Error: ${error.message}`, "error");
    } finally {
        showLoading(false);
    }
}

// ==================== DISPLAY KEY ====================
function displayKeyToUser(noteTitle, key, docId) {
    const keyDisplay = document.getElementById('generatedKey');
    const keySection = document.getElementById('keySection');

    if (keyDisplay && keySection) {
        keyDisplay.innerHTML = `
            <strong>For Note:</strong> ${noteTitle}<br>
            <strong>Document ID:</strong> ${docId}<br><br>
            <strong style="color: #e74c3c; font-size: 20px;">${key}</strong>
        `;
        keySection.style.display = 'block';
        keySection.scrollIntoView({ behavior: 'smooth' });

        const keyHistory = JSON.parse(localStorage.getItem('keyHistory') || '[]');
        keyHistory.push({ note: noteTitle, key: key, time: new Date().toISOString(), docId: docId });
        localStorage.setItem('keyHistory', JSON.stringify(keyHistory));
    }
}

function hideKey() {
    document.getElementById('keySection').style.display = 'none';
    currentKey = null;
    showStatus("Key hidden from view", "info");
}

function clearForm() {
    document.getElementById('noteName').value = '';
    document.getElementById('username').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('noteText').value = '';
    document.getElementById('noteName').focus();
}

function updateNoteCounter() {
    const noteCountElement = document.getElementById('noteCount');
    if (noteCountElement) noteCountElement.textContent = `${savedNotes.length} notes`;
}

// ==================== KEY DOWNLOAD ====================
function downloadKey() {
    if (!currentKey) return showStatus("No key available to download", "error");

    const keyDisplay = document.getElementById('generatedKey');
    const noteInfo = keyDisplay.textContent.split('\n')[0];

    const fileName = `aes-key-${Date.now()}.txt`;
    const fileContent = `AES-256 Base64 Key Generated: ${new Date().toLocaleString()}

Note Info: ${noteInfo}

🔑 YOUR AES KEY:
${currentKey}

⚠️ Store this key securely. Without it, notes are permanently inaccessible.
`;

    const element = document.createElement('a');
    element.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(fileContent);
    element.download = fileName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    showStatus("✅ Key downloaded successfully as " + fileName, "success");
}

// ==================== DECRYPTION ====================
async function decryptNotes() {
    const key = document.getElementById('decryptKey').value.trim();
    if (!key) return showDecryptStatus("❌ Please enter an AES key", "error");

    showDecryptLoading(true);
    showDecryptStatus("⏳ Loading and decrypting notes...", "info");

    try {
        if (!initializeFirebase()) throw new Error("Firebase not available");

        const querySnapshot = await firebaseDb.collection("notes").get();
        const notesTable = document.getElementById('notesTable');
        if (!notesTable) return;

        let html = `<table><thead>
            <tr><th>Note Name</th><th>Username</th><th>Phone</th><th>Note Content</th><th>Created</th><th>Status</th></tr>
        </thead><tbody>`;

        let decryptedCount = 0, errorCount = 0;

        for (const doc of querySnapshot.docs) {
            const data = doc.data();
            try {
                const keyWA = CryptoJS.enc.Base64.parse(key);
                const ivWA = CryptoJS.enc.Base64.parse(data.encryptedNote.iv);

                const decrypted = CryptoJS.AES.decrypt(
                    { ciphertext: CryptoJS.enc.Base64.parse(data.encryptedNote.ciphertext) },
                    keyWA,
                    { iv: ivWA, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
                );

                const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
                if (decryptedString) {
                    const obj = JSON.parse(decryptedString);
                    decryptedCount++;
                    html += `<tr style="background: #d4edda;">
                        <td>${obj.noteName}</td><td>${obj.username}</td><td>${obj.phone}</td>
                        <td>${obj.noteText.substring(0, 100)}${obj.noteText.length > 100 ? '...' : ''}</td>
                        <td>${new Date(obj.timestamp).toLocaleString()}</td>
                        <td><span style="color: #27ae60;">✅ Decrypted</span></td>
                    </tr>`;
                } else errorCount++;
            } catch {
                errorCount++;
            }
        }

        html += '</tbody></table>';
        notesTable.innerHTML = html;

        showDecryptStatus(`✅ Successfully decrypted ${decryptedCount} note(s)`, "success");

    } catch (error) {
        showDecryptStatus(`❌ Error: ${error.message}`, "error");
    } finally {
        showDecryptLoading(false);
    }
}

// ==================== SYSTEM FUNCTIONS ====================
async function checkFirebase() {
    showStatus("Testing Firebase connection...", "info");
    try {
        if (!initializeFirebase()) throw new Error("Firebase initialization failed");
        const testRef = firebaseDb.collection("connection_tests").doc("test");
        await testRef.set({ test: true, timestamp: new Date().toISOString() });
        const doc = await testRef.get();
        if (doc.exists) {
            updateStatus("Firebase Connected ✓", true);
            showStatus("✅ Firebase connection test successful!", "success");
        } else throw new Error("Test document not found");
    } catch (error) {
        updateStatus("Firebase Error", false);
        showStatus(`❌ Firebase test failed: ${error.message}`, "error");
    }
}

async function refreshStats() {
    try {
        if (!initializeFirebase()) return;
        const querySnapshot = await firebaseDb.collection("notes").get();
        document.getElementById('noteCountDisplay').textContent = querySnapshot.size;
        noteCounter = querySnapshot.size;
        updateNoteCounter();
    } catch (error) {
        console.error("Error refreshing stats:", error);
    }
}

function clearAllData() {
    if (confirm("⚠️ WARNING: This will clear all locally saved notes and keys. Firebase data will remain. Continue?")) {
        localStorage.clear();
        savedNotes = [];
        currentKey = null;
        updateNoteCounter();
        showStatus("All local data cleared", "success");
        document.getElementById('notesTable').innerHTML = '';
        document.getElementById('keySection').style.display = 'none';
        refreshStats();
    }
}

// ==================== GLOBAL FUNCTION EXPORTS ====================
window.addNote = addNote;
window.decryptNotes = decryptNotes;
window.downloadKey = downloadKey;
window.checkFirebase = checkFirebase;
window.clearForm = clearForm;
window.hideKey = hideKey;
window.refreshStats = refreshStats;
window.clearAllData = clearAllData;

console.log("✅ All functions loaded and ready!");
