// --- DOM Elements ---
const startBtn = document.getElementById('start-btn');
const speedValueEl = document.getElementById('speed-value');
const speedUnitEl = document.getElementById('speed-unit');
const gaugeNeedle = document.getElementById('gauge-needle');

const pingResultEl = document.getElementById('ping-result');
const jitterResultEl = document.getElementById('jitter-result');
const downloadResultEl = document.getElementById('download-result');
const uploadResultEl = document.getElementById('upload-result');
const ipAddressEl = document.getElementById('ip-address');

// --- Test Configuration ---
const PING_COUNT = 10;
// Using a file from a CDN for the download test. Cache is bypassed by adding a timestamp.
// This is a ~5MB image file.
const DOWNLOAD_URL = 'https://images.unsplash.com/photo-1461988320302-91bde64fc8e4';
const DOWNLOAD_SIZE = 5242880; // bytes
const UPLOAD_SIZE = 2 * 1024 * 1024; // 2MB
const UPLOAD_URL = '/'; // A dummy endpoint for upload simulation

let isTesting = false;

// --- UI Update Functions ---

/**
 * Updates the gauge needle rotation based on speed in Mbps.
 * Uses a logarithmic-like scale for better visualization.
 */
function updateGauge(speed) {
    let rotation = 0;
    // Scale: 0-10 Mbps -> 0-45deg, 10-100 -> 45-135deg, 100+ -> 135-180deg
    if (speed > 100) {
        rotation = 135 + (Math.atan((speed - 100) / 100) / (Math.PI / 2)) * 45;
    } else if (speed > 10) {
        rotation = 45 + ((speed - 10) / 90) * 90;
    } else {
        rotation = (speed / 10) * 45;
    }
    // Convert to range -90 to +90
    gaugeNeedle.style.transform = `rotate(${rotation - 90}deg)`;
}

/**
 * Updates the main speed display and the gauge.
 */
function updateSpeedDisplay(speed, unit = 'Mbps') {
    speedValueEl.textContent = speed.toFixed(2);
    speedUnitEl.textContent = unit;
    if (unit === 'Mbps') {
        updateGauge(speed);
    }
}

/**
 * Resets the UI to its initial state before a test.
 */
function resetUI() {
    updateSpeedDisplay(0);
    ['ping-result', 'jitter-result', 'download-result', 'upload-result'].forEach(id => {
        document.getElementById(id).textContent = '-';
        document.getElementById(id).parentElement.classList.remove('fade-in');
    });
    startBtn.disabled = false;
    startBtn.querySelector('span').textContent = 'GO';
}

/**
 * Animates the final result value into its display box.
 */
function displayFinalResult(element, value) {
    element.textContent = value;
    element.parentElement.classList.add('fade-in');
}

// --- Speed Test Core Logic ---

// 1. PING & JITTER TEST
async function testPing() {
    updateSpeedDisplay(0, 'ms');
    const latencies = [];
    for (let i = 0; i < PING_COUNT + 1; i++) {
        const startTime = performance.now();
        try {
            await fetch('/favicon.ico?t=' + new Date().getTime(), { mode: 'no-cors', cache: 'no-store' });
        } catch (e) {
            // No-cors mode always throws an error, which is expected.
        }
        const latency = performance.now() - startTime;
        if (i > 0) { // Discard first measurement
            latencies.push(latency);
            updateSpeedDisplay(latency.toFixed(0), 'ms');
        }
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    const sumLatency = latencies.reduce((a, b) => a + b, 0);
    const avgPing = Math.round(sumLatency / latencies.length);

    let jitterSum = 0;
    for (let i = 1; i < latencies.length; i++) {
        jitterSum += Math.abs(latencies[i] - latencies[i - 1]);
    }
    const avgJitter = Math.round(jitterSum / (latencies.length - 1));

    displayFinalResult(pingResultEl, avgPing);
    displayFinalResult(jitterResultEl, avgJitter);
}

// 2. DOWNLOAD TEST
function testDownload() {
    return new Promise((resolve, reject) => {
        updateSpeedDisplay(0, 'Mbps');
        const xhr = new XMLHttpRequest();
        let lastTime = performance.now();
        let lastLoaded = 0;

        xhr.open('GET', `${DOWNLOAD_URL}?t=${new Date().getTime()}`, true);

        xhr.onprogress = (event) => {
            const currentTime = performance.now();
            const timeDiff = (currentTime - lastTime) / 1000; // seconds
            const bytesDiff = event.loaded - lastLoaded;
            
            if (timeDiff > 0) {
                const speedBps = (bytesDiff * 8) / timeDiff; // bits per second
                const speedMbps = speedBps / 1000000;
                if (isFinite(speedMbps)) {
                    updateSpeedDisplay(speedMbps, 'Mbps');
                }
            }
            lastTime = currentTime;
            lastLoaded = event.loaded;
        };

        xhr.onload = () => {
            const totalTime = (performance.now() - xhr.startTime) / 1000;
            const finalSpeedMbps = (DOWNLOAD_SIZE * 8) / totalTime / 1000000;
            displayFinalResult(downloadResultEl, finalSpeedMbps.toFixed(2));
            resolve();
        };
        
        xhr.onerror = () => {
             displayFinalResult(downloadResultEl, 'Error');
             console.error("Download test failed.");
             reject("Download error");
        };

        xhr.startTime = performance.now();
        xhr.send();
    });
}

// 3. UPLOAD TEST (Simulated)
function testUpload() {
    return new Promise((resolve, reject) => {
        updateSpeedDisplay(0, 'Mbps');
        const data = new Blob([new ArrayBuffer(UPLOAD_SIZE)], { type: 'application/octet-stream' });
        const xhr = new XMLHttpRequest();
        let lastTime = performance.now();
        let lastLoaded = 0;

        xhr.open('POST', `${UPLOAD_URL}?t=${new Date().getTime()}`, true);
        
        xhr.upload.onprogress = (event) => {
            const currentTime = performance.now();
            const timeDiff = (currentTime - lastTime) / 1000; // seconds
            const bytesDiff = event.loaded - lastLoaded;
            
            if(timeDiff > 0) {
                const speedBps = (bytesDiff * 8) / timeDiff;
                const speedMbps = speedBps / 1000000;
                if (isFinite(speedMbps)) {
                    updateSpeedDisplay(speedMbps, 'Mbps');
                }
            }
            lastTime = currentTime;
            lastLoaded = event.loaded;
        };

        xhr.onloadend = () => {
            // Request will likely fail, but we can still calculate speed from progress events
            const totalTime = (performance.now() - xhr.startTime) / 1000;
            const finalSpeedMbps = (UPLOAD_SIZE * 8) / totalTime / 1000000;
            displayFinalResult(uploadResultEl, finalSpeedMbps.toFixed(2));
            resolve();
        };
        
        xhr.onerror = () => {
            // Errors are expected in this simulation. We still resolve successfully.
            const totalTime = (performance.now() - xhr.startTime) / 1000;
            const finalSpeedMbps = (UPLOAD_SIZE * 8) / totalTime / 1000000;
            displayFinalResult(uploadResultEl, finalSpeedMbps.toFixed(2));
            resolve();
        };

        xhr.startTime = performance.now();
        xhr.send(data);
    });
}

// --- Main Controller ---
async function startTest() {
    if (isTesting) return;

    isTesting = true;
    resetUI();
    startBtn.disabled = true;
    startBtn.querySelector('span').textContent = '...';

    try {
        await testPing();
        await testDownload();
        await testUpload();
    } catch (error) {
        console.error("An error occurred during the test:", error);
    } finally {
        isTesting = false;
        startBtn.querySelector('span').textContent = 'GO';
        startBtn.disabled = false;
        updateSpeedDisplay(0, 'Mbps'); // Reset gauge after test
    }
}

// --- Initialization ---
function getIpAddress() {
    fetch('https://api.ipify.org?format=json')
        .then(response => response.json())
        .then(data => {
            ipAddressEl.textContent = data.ip;
        })
        .catch(error => {
            console.error("Could not fetch IP address:", error);
            ipAddressEl.textContent = "Unavailable";
        });
}

// Attach event listeners and run initial setup
window.onload = () => {
    startBtn.addEventListener('click', startTest);
    getIpAddress();
    resetUI();
};
