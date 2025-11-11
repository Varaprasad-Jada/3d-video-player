import { createIcons, Play, Pause, RotateCcw, RotateCw, Expand } from 'https://unpkg.com/lucide@latest';

// Initialize Lucide Icons
function initIcons() {
    createIcons({ icons: { Play, Pause, RotateCcw, RotateCw, Expand } });
}


// Constants for Firebase (MANDATORY variables for the environment)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
// No Firebase used in this app, so initialization is skipped.

// --- DOM Elements ---
const videoInput = document.getElementById('videoFile');
const sourceVideo = document.getElementById('sourceVideo');
const outputCanvas = document.getElementById('outputCanvas');
const statusText = document.getElementById('status');
const playPauseButton = document.getElementById('playPause');
const playPauseIcon = document.getElementById('playPauseIcon');
const playPauseText = document.getElementById('playPauseText');
const skipForwardButton = document.getElementById('skipForward');
const skipBackwardButton = document.getElementById('skipBackward');
const fullscreenToggle = document.getElementById('fullscreenToggle');
const anaglyphModeButtons = document.querySelectorAll('.anaglyph-mode-btn');
const ctx = outputCanvas.getContext('2d');

let animationFrameId = null;
let isVideoPlaying = false;
let anaglyphMode = 'red_cyan'; // Default mode
let isFullscreenSimulated = false; // NEW: State to manage the CSS/simulated state

// Store the initial canvas dimensions (CSS styles)
let initialCanvasWidthStyle = '';
let initialCanvasHeightStyle = '';

// Anaglyph Matrix/Logic Map
const ANAGLYPH_MODES = {
    'red_cyan': { left: [1, 0, 0], right: [0, 1, 1] },
    'green_magenta': { left: [0, 1, 0], right: [1, 0, 1] },
    'blue_yellow': { left: [0, 0, 1], right: [1, 1, 0] },
};

/**
 * Calculates the grayscale value using standard luminosity weights.
 * @param {number} r Red value (0-255)
 * @param {number} g Green value (0-255)
 * @param {number} b Blue value (0-255)
 * @returns {number} The weighted grayscale value (0-255)
 */
function getGrayscale(r, g, b) {
    return (r * 0.3) + (g * 0.59) + (b * 0.11);
}

/**
 * Handles file selection and sets up the video element.
 */
videoInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        statusText.textContent = "Loading video...";
        const videoURL = URL.createObjectURL(file);

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }

        sourceVideo.src = videoURL;
        sourceVideo.load();
        sourceVideo.playbackRate = 1.0;
        sourceVideo.muted = false; // Allow sound, as user interaction is required anyway

        sourceVideo.onloadedmetadata = () => {
            const originalWidth = sourceVideo.videoWidth;
            const originalHeight = sourceVideo.videoHeight;

            outputCanvas.width = originalWidth / 2;
            outputCanvas.height = originalHeight;

            // Adjust CSS size for better viewing on screen
            const maxWidth = window.innerWidth * 0.9;
            const maxHeight = window.innerHeight * 0.7;

            const ratio = Math.min(maxWidth / outputCanvas.width, maxHeight / outputCanvas.height);
            // Set and store initial size
            initialCanvasWidthStyle = (outputCanvas.width * ratio) + 'px';
            initialCanvasHeightStyle = (outputCanvas.height * ratio) + 'px';

            outputCanvas.style.width = initialCanvasWidthStyle;
            outputCanvas.style.height = initialCanvasHeightStyle;

            statusText.textContent = "Video loaded. Click the Play button or canvas to start.";
        };

        sourceVideo.oncanplay = () => {
            // Initial attempt to play
            attemptPlayback();
        };

    }
});

/**
 * Toggles play/pause state.
 */
function togglePlayback() {
    if (!sourceVideo.src) {
        statusText.textContent = "Please select a video file first.";
        return;
    }

    if (sourceVideo.paused) {
        attemptPlayback();
    } else {
        sourceVideo.pause();
        isVideoPlaying = false;
        updatePlayPauseButton(false);
        statusText.textContent = "Video paused.";
    }
}

/**
 * Attempts to start video playback and handle autoplay restrictions.
 */
function attemptPlayback() {
     sourceVideo.play().then(() => {
        isVideoPlaying = true;
        updatePlayPauseButton(true);
        statusText.textContent = "Video playing (Anaglyph 3D).";
        // Start the frame processing loop
        if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(processFrame);
        }
    }).catch(e => {
        // Autoplay failed, require user interaction
        isVideoPlaying = false;
        updatePlayPauseButton(false);
        statusText.textContent = "Playback blocked. Click Play or the canvas to start.";
    });
}

/**
 * Updates the Play/Pause button UI.
 * @param {boolean} isPlaying - True if playing, false if paused.
 */
function updatePlayPauseButton(isPlaying) {
    if (isPlaying) {
        playPauseIcon.setAttribute('data-lucide', 'pause');
        playPauseText.textContent = 'Pause';
    } else {
        playPauseIcon.setAttribute('data-lucide', 'play');
        playPauseText.textContent = 'Play';
    }
    // Re-render the icon after changing its name
    initIcons(); 
}

// Event Listeners for Playback Controls
playPauseButton.addEventListener('click', togglePlayback);

skipForwardButton.addEventListener('click', () => skipVideo(10));
skipBackwardButton.addEventListener('click', () => skipVideo(-10));

/**
 * Skips the video forward or backward by a given number of seconds.
 * @param {number} seconds - Amount to skip (positive for forward, negative for backward).
 */
function skipVideo(seconds) {
    if (sourceVideo.src) {
        sourceVideo.currentTime = Math.max(0, sourceVideo.currentTime + seconds);
        statusText.textContent = `Skipped ${seconds > 0 ? '+' : ''}${seconds} seconds.`;
    }
}

// Double-tap/click skip functionality on canvas
outputCanvas.addEventListener('dblclick', (e) => {
    const rect = outputCanvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const halfWidth = rect.width / 2;

    if (clickX > halfWidth) {
        // Double click on the right half: Forward
        skipVideo(10);
    } else {
        // Double click on the left half: Backward
        skipVideo(-10);
    }
});

// Anaglyph Mode Selection
anaglyphModeButtons.forEach(button => {
    button.addEventListener('click', () => {
        anaglyphMode = button.getAttribute('data-mode');

        // Update visual state
        anaglyphModeButtons.forEach(btn => btn.classList.remove('border-4', 'border-white', 'focus:ring-4', 'focus:ring-red-500/50'));
        button.classList.add('border-4', 'border-white', 'focus:ring-4', 'focus:ring-red-500/50');

        statusText.textContent = `Filter changed to ${anaglyphMode.replace('_', ' ')}.`;
    });
});

// Set initial active filter style
// Ensure the element exists before accessing classList
const defaultFilterButton = document.querySelector('[data-mode="red_cyan"]');
if (defaultFilterButton) {
    defaultFilterButton.classList.add('border-4', 'border-white');
}


/**
 * The core real-time video processing loop.
 */
function processFrame() {
    if (sourceVideo.paused || sourceVideo.ended) {
        animationFrameId = null;
        return;
    }

    const width = outputCanvas.width;
    const height = outputCanvas.height;
    const sourceWidth = sourceVideo.videoWidth;
    const mode = ANAGLYPH_MODES[anaglyphMode];

    if (!mode || width === 0 || height === 0) {
        animationFrameId = requestAnimationFrame(processFrame);
        return; // Skip if video not ready
    }

    // Draw Left Eye
    ctx.drawImage(sourceVideo, 
        0, 0, sourceWidth / 2, height,  // Source: Left half
        0, 0, width, height             // Destination: Full canvas
    );
    const leftData = ctx.getImageData(0, 0, width, height);
    const leftPixels = leftData.data;

    // Draw Right Eye
    ctx.drawImage(sourceVideo, 
        sourceWidth / 2, 0, sourceWidth / 2, height, // Source: Right half
        0, 0, width, height                          // Destination: Full canvas
    );
    const rightData = ctx.getImageData(0, 0, width, height);
    const rightPixels = rightData.data;

    // Anaglyph Conversion Loop
    for (let i = 0; i < leftPixels.length; i += 4) {
        const R_L = leftPixels[i];
        const G_L = leftPixels[i + 1];
        const B_L = leftPixels[i + 2];
        
        const R_R = rightPixels[i];
        const G_R = rightPixels[i + 1];
        const B_R = rightPixels[i + 2];
        
        // Grayscale calculation for the receiving eye's color channels
        const R_L_Gray = getGrayscale(R_L, G_L, B_L);
        const G_L_Gray = getGrayscale(R_L, G_L, B_L);
        const B_L_Gray = getGrayscale(R_L, G_L, B_L);
        
        const R_R_Gray = getGrayscale(R_R, G_R, B_R);
        const G_R_Gray = getGrayscale(R_R, G_R, B_R);
        const B_R_Gray = getGrayscale(R_R, G_R, B_R);
        
        // Anaglyph Logic (Matrix implementation)
        // Left (pure color) + Right (grayscale)

        // Red Output Channel
        const R_out = (mode.left[0] === 1 ? R_L : R_L_Gray) * mode.left[0] + 
                      (mode.right[0] === 1 ? R_R_Gray : 0) * mode.right[0];

        // Green Output Channel
        const G_out = (mode.left[1] === 1 ? G_L : G_L_Gray) * mode.left[1] + 
                      (mode.right[1] === 1 ? G_R_Gray : 0) * mode.right[1];

        // Blue Output Channel
        const B_out = (mode.left[2] === 1 ? B_L : B_L_Gray) * mode.left[2] + 
                      (mode.right[2] === 1 ? B_R_Gray : 0) * mode.right[2];


        leftPixels[i] = R_out;
        leftPixels[i + 1] = G_out;
        leftPixels[i + 2] = B_out;
    }

    // Put the processed pixel data back onto the canvas
    ctx.putImageData(leftData, 0, 0);

    // Loop again for the next frame
    animationFrameId = requestAnimationFrame(processFrame);
}

/**
 * Toggles the CSS class to simulate fullscreen within the iframe boundary.
 * @param {boolean} enable - True to enable, false to disable.
 */
function toggleSimulatedFullscreen(enable) {
    if (enable) {
        outputCanvas.classList.add('fullscreen-active');
        outputCanvas.style.width = '100vw';
        outputCanvas.style.height = '100vh';
    } else {
        outputCanvas.classList.remove('fullscreen-active');
        outputCanvas.style.width = initialCanvasWidthStyle;
        outputCanvas.style.height = initialCanvasHeightStyle;
    }
    isFullscreenSimulated = enable;
}


/**
 * Fullscreen Logic (FIXED to handle permissions error gracefully)
 */
fullscreenToggle.addEventListener('click', () => {
    if (document.fullscreenElement) {
        // Case 1: Native fullscreen is active -> Exit native
        document.exitFullscreen();
    } else if (isFullscreenSimulated) {
        // Case 2: Only simulation is active -> Exit simulation
        toggleSimulatedFullscreen(false);
        statusText.textContent = "Exited full-window view.";
    } else {
        // Case 3: Neither is active -> Enter simulation and attempt native
        toggleSimulatedFullscreen(true);
        statusText.textContent = "Full-window view active. (Native fullscreen may be blocked by environment)";
        
        outputCanvas.requestFullscreen().catch(err => {
            // We suppress the console error here but keep the simulation active.
            // The status bar already informed the user of the limitation.
        });
    }
});

// Handle native fullscreen exit that might happen outside of our click (e.g., ESC key)
document.addEventListener('fullscreenchange', () => {
    // If native exit occurs (like pressing ESC) AND we were in our simulated state, 
    // we need to ensure the CSS class is removed.
    if (!document.fullscreenElement && isFullscreenSimulated) {
        toggleSimulatedFullscreen(false);
        statusText.textContent = "Exited full-window view.";
    }
});


// Initial setup on load
window.onload = function () {
    // Initial draw to ensure the canvas is black
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
    
    statusText.textContent = "Ready. Please select a video file.";
    updatePlayPauseButton(false);
    initIcons(); // Initialize icons on load
}