import './style.css'
import jsQR from 'jsqr'

let isScanning = false;
let stream: MediaStream | null = null;
let lastResultStr = "";
let detectedUrl = "";

const videoWrapper = document.getElementById('video-wrapper') as HTMLDivElement;
const video = document.getElementById('qr-video') as HTMLVideoElement;
const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement;
const context = canvas.getContext('2d', { willReadFrequently: true });
const toggleBtn = document.getElementById('toggle-btn') as HTMLButtonElement;
const resultContainer = document.getElementById('result-container') as HTMLDivElement;
const resultText = document.getElementById('result-text') as HTMLElement;

const resultLinkBtn = document.getElementById('result-link') as HTMLButtonElement;

if (!context) throw new Error("Could not get canvas context");


function drawQuad(location: {
  topLeftCorner: { x: number; y: number };
  topRightCorner: { x: number; y: number };
  bottomRightCorner: { x: number; y: number };
  bottomLeftCorner: { x: number; y: number };
}, color: string) {
  if (!context) return;
  
  context.beginPath();
  context.moveTo(location.topLeftCorner.x, location.topLeftCorner.y);
  context.lineTo(location.topRightCorner.x, location.topRightCorner.y);
  context.lineTo(location.bottomRightCorner.x, location.bottomRightCorner.y);
  context.lineTo(location.bottomLeftCorner.x, location.bottomLeftCorner.y);
  context.closePath(); 
  
  context.lineWidth = 4;
  context.strokeStyle = color;
  context.stroke();
}

function tick() {
  if (!isScanning) return;

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.height = video.videoHeight;
    canvas.width = video.videoWidth;
    context!.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = context!.getImageData(0, 0, canvas.width, canvas.height);

    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code) {
      drawQuad(code.location, "#ff6464");
      if (code.data !== lastResultStr) {
        lastResultStr = code.data;
        handleDetection(code.data);
      }
    }
  }
  requestAnimationFrame(tick);
}

function handleDetection(data: string) {
  resultContainer.classList.remove('hidden');
  resultText.textContent = data;

  const isUrl = isValidHttpUrl(data);
  
  if (isUrl) {
    detectedUrl = data;
    resultLinkBtn.classList.remove('hidden');
  } else {
    detectedUrl = "";
    resultLinkBtn.classList.add('hidden');
  }
}

function isValidHttpUrl(string: string) {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}

async function startScan() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: "environment" } 
    });
    
    video.srcObject = stream;
    video.setAttribute("playsinline", "true"); 
    await video.play();
    
    isScanning = true;
    
    videoWrapper.classList.add('scanning');
    requestAnimationFrame(tick);
    
    toggleBtn.textContent = "Stop Camera";
    resultContainer.classList.add("hidden"); 
    lastResultStr = ""; 
    
  } catch (err) {
    console.error("Error accessing camera:", err);
    alert("Camera access denied or not supported.");
  }
}

function stopScan() {
  isScanning = false;
  
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  
  videoWrapper.classList.remove('scanning');
  
  if (context && canvas) {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  toggleBtn.textContent = "Start Camera";
}

toggleBtn.addEventListener('click', () => {
  if (isScanning) {
    stopScan();
  } else {
    startScan();
  }
});

resultLinkBtn.addEventListener('click', () => {
  if (detectedUrl) {
    window.open(detectedUrl, '_blank');
  }
});