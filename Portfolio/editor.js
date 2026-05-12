// Track live video rotation and grayscale/sepia
let videoRotation = 0;
let videoGrayscaleActive = false;
let videoSepiaActive = false;

// Video Editor Button Selectors
const cutBtn = document.getElementById('cutBtn');
const videoMuteBtn = document.getElementById('videoMuteBtn');
const videoSpeedBtn = document.getElementById('videoSpeedBtn');
const videoReverseBtn = document.getElementById('videoReverseBtn');
const videoGrayscaleBtn = document.getElementById('videoGrayscaleBtn');
const videoSepiaBtn = document.getElementById('videoSepiaBtn');
const videoSnapshotBtn = document.getElementById('videoSnapshotBtn');
const videoRotateBtn = document.getElementById('videoRotateBtn');

// Photo Editor Button Selectors
const photoRotateBtn = document.getElementById('photoRotateBtn');
const photoGrayscaleBtn = document.getElementById('photoGrayscaleBtn');
const photoSepiaBtn = document.getElementById('photoSepiaBtn');
const photoBlurBtn = document.getElementById('photoBlurBtn');
const photoDownloadBtn = document.getElementById('photoDownloadBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');

function setHistoryButtonsVisible(visible) {
    const displayValue = visible ? 'inline-flex' : 'none';
    if (undoBtn) undoBtn.style.display = displayValue;
    if (redoBtn) redoBtn.style.display = displayValue;
}

let ffmpegInstance = null;
let ffmpegLoadPromise = null;

async function getFFmpegInstance() {
    if (!ffmpegInstance) {
        const { createFFmpeg } = ffmpeg;
        ffmpegInstance = createFFmpeg({ log: true });
    }
    if (!ffmpegInstance.isLoaded()) {
        if (!ffmpegLoadPromise) {
            ffmpegLoadPromise = ffmpegInstance.load();
        }
        await ffmpegLoadPromise;
    }
    return ffmpegInstance;
}

// Video Editor Variables
let reverseActive = false;
let reverseInterval = null;

// Video Editor Event Listeners
if (cutBtn) {
    cutBtn.onclick = async function() {
        const cutControls = document.getElementById('cutControls');
        if (cutControls) cutControls.style.display = 'flex';
        if (!videoFile) return alert('Please upload a video first.');
        message.textContent = 'Loading ffmpeg...';
        const { createFFmpeg, fetchFile } = ffmpeg;
        const ffmpeg = createFFmpeg({ log: true });
        await ffmpeg.load();
        message.textContent = 'Processing cut...';
        ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(videoFile));
        const start = startTime.value || '0';
        const end = endTime.value || videoPlayer.duration;
        await ffmpeg.run('-ss', start, '-to', end, '-i', 'input.mp4', '-c', 'copy', 'output.mp4');
        const data = ffmpeg.FS('readFile', 'output.mp4');
        const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
        message.innerHTML = `<a href=\"${url}\" download=\"cut-video.mp4\">Download Cut Video</a>`;
    };
}

if (videoMuteBtn) {
    videoMuteBtn.onclick = function() {
        if (videoPlayer.muted) {
            videoPlayer.muted = false;
            videoMuteBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>/<i class="fa-solid fa-volume-high"></i> Mute/Unmute';
        } else {
            videoPlayer.muted = true;
            videoMuteBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i> Muted';
        }
    };
}

if (videoSpeedBtn) {
    videoSpeedBtn.onclick = function() {
        let speed = prompt('Enter playback speed (e.g., 0.5, 1, 2):', videoPlayer.playbackRate);
        if (speed) videoPlayer.playbackRate = parseFloat(speed);
    };
}

if (videoReverseBtn) {
    videoReverseBtn.onclick = function() {
        if (!videoFile) {
            alert('Please upload a video first.');
            return;
        }
        reverseActive = !reverseActive;
        if (reverseActive) {
            videoReverseBtn.classList.add('active');
            videoPlayer.pause();
            reverseInterval = setInterval(() => {
                if (videoPlayer.currentTime <= 0.04) {
                    videoPlayer.pause();
                    videoPlayer.currentTime = 0;
                    clearInterval(reverseInterval);
                    reverseInterval = null;
                } else {
                    videoPlayer.currentTime -= 0.04;
                }
            }, 40);
            videoPlayer.muted = true;
        } else {
            videoReverseBtn.classList.remove('active');
            if (reverseInterval) {
                clearInterval(reverseInterval);
                reverseInterval = null;
            }
            videoPlayer.muted = false;
        }
    };
}

if (videoGrayscaleBtn) {
    videoGrayscaleBtn.onclick = function() {
        videoGrayscaleActive = !videoGrayscaleActive;
        const container = document.getElementById('videoPlayerContainer');
        if (container) {
            container.style.filter = videoGrayscaleActive ? 'grayscale(100%)' : '';
        }
        videoGrayscaleBtn.classList.toggle('active', videoGrayscaleActive);
    };
}

if (videoSepiaBtn) {
    videoSepiaBtn.onclick = function() {
        videoSepiaActive = !videoSepiaActive;
        const container = document.getElementById('videoPlayerContainer');
        if (container) {
            container.style.filter = videoSepiaActive ? 'sepia(100%)' : '';
        }
        videoSepiaBtn.classList.toggle('active', videoSepiaActive);
    };
}

if (videoSnapshotBtn) {
    videoSnapshotBtn.onclick = function() {
        const canvas = document.createElement('canvas');
        canvas.width = videoPlayer.videoWidth;
        canvas.height = videoPlayer.videoHeight;
        canvas.getContext('2d').drawImage(videoPlayer, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = 'snapshot.png';
        a.click();
    };
}

if (videoRotateBtn) {
    videoRotateBtn.onclick = function() {
        videoRotation = (videoRotation + 90) % 360;
        const container = document.getElementById('videoPlayerContainer');
        if (container) {
            container.style.transform = `rotate(${videoRotation}deg)`;
            container.style.transition = 'transform 0.3s';
        }
    };
}

// Photo Editor Variables
let img = new Image();
let rotation = 0;
let photoHistory = [];
let historyIndex = -1;
let effectState = {
    grayscale: false,
    sepia: false,
    blur: false
};

// Photo Editor Functions
function applyFilters(saveHistory = true) {
    const ctx = photoCanvas.getContext('2d');
    ctx.clearRect(0, 0, photoCanvas.width, photoCanvas.height);
    ctx.save();
    let filter = `brightness(${brightness.value}%) contrast(${contrast.value}%)`;
    if (smoothness.value > 0) {
        filter += ` blur(${smoothness.value}px)`;
    }
    if (effectState.grayscale) filter += ' grayscale(100%)';
    if (effectState.sepia) filter += ' sepia(100%)';
    if (effectState.blur) filter += ' blur(4px)';
    ctx.filter = filter;
    ctx.translate(photoCanvas.width / 2, photoCanvas.height / 2);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-photoCanvas.width / 2, -photoCanvas.height / 2);
    ctx.drawImage(img, 0, 0);
    if (smoothness.value < 0) {
        ctx.filter = `contrast(${100 + Math.abs(smoothness.value) * 10}%)`;
        ctx.drawImage(photoCanvas, 0, 0);
    }
    ctx.restore();
    photoImg.src = photoCanvas.toDataURL();
    if (saveHistory) savePhotoHistory();
}

function savePhotoHistory() {
    if (historyIndex < photoHistory.length - 1) {
        photoHistory = photoHistory.slice(0, historyIndex + 1);
    }
    photoHistory.push(photoCanvas.toDataURL());
    historyIndex = photoHistory.length - 1;
    updateHistoryButtons();
}

function undoPhoto() {
    if (historyIndex > 0) {
        historyIndex--;
        restorePhotoHistory();
        updateHistoryButtons();
    }
}

function redoPhoto() {
    if (historyIndex < photoHistory.length - 1) {
        historyIndex++;
        restorePhotoHistory();
        updateHistoryButtons();
    }
}

function restorePhotoHistory() {
    let dataUrl = photoHistory[historyIndex];
    let tempImg = new Image();
    tempImg.onload = function() {
        photoCanvas.width = tempImg.width;
        photoCanvas.height = tempImg.height;
        const ctx = photoCanvas.getContext('2d');
        ctx.clearRect(0, 0, photoCanvas.width, photoCanvas.height);
        ctx.drawImage(tempImg, 0, 0);
        photoImg.src = photoCanvas.toDataURL();
    };
    tempImg.src = dataUrl;
}

function updateHistoryButtons() {
    if (undoBtn) {
        undoBtn.disabled = historyIndex <= 0;
    }
    if (redoBtn) {
        redoBtn.disabled = historyIndex >= photoHistory.length - 1;
    }
}

// Photo Editor Event Listeners
if (photoRotateBtn) {
    photoRotateBtn.addEventListener('click', function() {
        rotation = (rotation + 90) % 360;
        applyFilters();
    });
}

if (photoGrayscaleBtn) {
    photoGrayscaleBtn.addEventListener('click', function() {
        effectState.grayscale = !effectState.grayscale;
        applyFilters();
    });
}

if (photoSepiaBtn) {
    photoSepiaBtn.addEventListener('click', function() {
        effectState.sepia = !effectState.sepia;
        applyFilters();
    });
}

if (photoBlurBtn) {
    photoBlurBtn.addEventListener('click', function() {
        effectState.blur = !effectState.blur;
        applyFilters();
    });
}

if (photoDownloadBtn) {
    photoDownloadBtn.addEventListener('click', function() {
        const link = document.createElement('a');
        link.href = photoCanvas.toDataURL('image/png');
        link.download = 'edited-photo.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

if (undoBtn) {
    undoBtn.addEventListener('click', undoPhoto);
}

if (redoBtn) {
    redoBtn.addEventListener('click', redoPhoto);
}

// File Input Listeners
const videoInput = document.getElementById('videoInput');
const videoSection = document.getElementById('videoSection');
const videoPlayer = document.getElementById('videoPlayer');
const videoTools = document.getElementById('videoTools');
const startTime = document.getElementById('startTime');
const endTime = document.getElementById('endTime');
const exportBtn = document.getElementById('exportBtn');
const message = document.getElementById('message');
let videoFile = null;

// --- Live preview and display for cut tool ---
function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
}

function updateCutPreview() {
    const start = parseFloat(startTime.value) || 0;
    const end = parseFloat(endTime.value) || videoPlayer.duration;
    // Seek to start time if user changes start
    if (!isNaN(start) && start >= 0 && start < end && end <= videoPlayer.duration) {
        videoPlayer.currentTime = start;
    }
    // Update display
    const startDisp = document.getElementById('startTimeDisplay');
    const endDisp = document.getElementById('endTimeDisplay');
    if (startDisp) startDisp.textContent = `(${formatTime(start)})`;
    if (endDisp) endDisp.textContent = `(${formatTime(end)})`;
}

startTime.addEventListener('input', updateCutPreview);
endTime.addEventListener('input', updateCutPreview);

// Initialize display on load
window.addEventListener('DOMContentLoaded', function() {
    updateCutPreview();
    // Hide cut controls by default
    const cutControls = document.getElementById('cutControls');
    if (cutControls) cutControls.style.display = 'none';
});

// Restrict playback to selected segment
videoPlayer.addEventListener('timeupdate', function() {
    const start = parseFloat(startTime.value) || 0;
    const end = parseFloat(endTime.value) || videoPlayer.duration;
    if (!isNaN(start) && !isNaN(end) && end > start && videoPlayer.currentTime > end) {
        videoPlayer.pause();
        videoPlayer.currentTime = start;
    }
});

videoInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        videoFile = file;
        const url = URL.createObjectURL(file);
        videoPlayer.src = url;
        videoSection.style.display = 'block';
        videoTools.style.display = 'flex';
        message.textContent = '';
        videoRotation = 0;
        const container = document.getElementById('videoPlayerContainer');
        if (container) container.style.transform = '';
        videoPlayer.onloadedmetadata = function() {
            startTime.max = videoPlayer.duration;
            endTime.max = videoPlayer.duration;
            endTime.value = Math.floor(videoPlayer.duration);
            exportBtn.disabled = false;
        };
    } else {
        videoTools.style.display = 'none';
    }
});

exportBtn.addEventListener('click', async function() {
    const start = parseFloat(startTime.value);
    const end = parseFloat(endTime.value);
    if (isNaN(start) || isNaN(end) || start < 0 || end <= start || end > videoPlayer.duration) {
        message.textContent = 'Please enter valid start and end times.';
        return;
    }
    if (!videoFile) {
        message.textContent = 'Please upload a video before exporting.';
        return;
    }

    exportBtn.disabled = true;
    message.textContent = 'Preparing FFmpeg...';

    try {
        const ffmpegCore = await getFFmpegInstance();
        const { fetchFile } = ffmpeg;
        const inputName = 'input.mp4';
        const outputName = 'trimmed-output.mp4';

        try {
            ffmpegCore.FS('unlink', inputName);
        } catch (err) {}
        try {
            ffmpegCore.FS('unlink', outputName);
        } catch (err) {}

        message.textContent = 'Trimming video...';
        ffmpegCore.FS('writeFile', inputName, await fetchFile(videoFile));

        const duration = (end - start).toFixed(2);
        await ffmpegCore.run(
            '-ss', `${start}`,
            '-i', inputName,
            '-t', `${duration}`,
            '-c', 'copy',
            outputName
        );

        const data = ffmpegCore.FS('readFile', outputName);
        const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
        message.innerHTML = `<a href="${url}" download="trimmed-video.mp4">Download trimmed video</a>`;
    } catch (error) {
        console.error('Failed to trim video', error);
        message.textContent = 'Failed to export trimmed video. Please try again.';
    } finally {
        exportBtn.disabled = false;
    }
});

const photoInput = document.getElementById('photoInput');
const photoSection = document.getElementById('photoSection');
const photoCanvas = document.getElementById('photoCanvas');
const photoImg = document.getElementById('photoImg');
const brightness = document.getElementById('brightness');
const contrast = document.getElementById('contrast');
const smoothness = document.getElementById('smoothness');

photoInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        img.src = url;
        img.onload = function() {
            photoCanvas.width = img.width;
            photoCanvas.height = img.height;
            rotation = 0;
            photoSection.style.display = 'block';
            setHistoryButtonsVisible(true);
            applyFilters();
            photoHistory = [photoCanvas.toDataURL()];
            historyIndex = 0;
            updateHistoryButtons();
        };
    }
});

// Add event listeners for sliders
brightness.addEventListener('input', () => applyFilters());
contrast.addEventListener('input', () => applyFilters());
smoothness.addEventListener('input', () => applyFilters());

updateHistoryButtons();
setHistoryButtonsVisible(false);