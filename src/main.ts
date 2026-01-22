import './style.css'
import jsQR from 'jsqr'

let isScanning = false;
let stream: MediaStream | null = null;
let lastResultStr = "";
let detectedUrl = "";

const scannerBlock = document.getElementById('scanner-block') as HTMLButtonElement;
const resultBar = document.getElementById('result-bar') as HTMLDivElement;
const resultText = document.getElementById('result-text') as HTMLSpanElement;
const video = document.getElementById('qr-video') as HTMLVideoElement;
const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement;
const context = canvas.getContext('2d', { willReadFrequently: true });

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
  const isUrl = isValidHttpUrl(data);
  resultBar.classList.add('detected');

  if (isUrl) {
    resultText.textContent = `Tap to open -> ${data}`;
    detectedUrl = data;
    scannerBlock.classList.add('pulsating');
  } else {
    resultText.textContent = data;
    resultText.textContent = data;
    detectedUrl = "";
    scannerBlock.classList.remove('pulsating');
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
    scannerBlock.classList.add('scanning');

    
    resultBar.classList.remove('detected'); 
    resultText.textContent = "Show a QR Code";
    
    scannerBlock.classList.remove('pulsating');
    lastResultStr = "";
    detectedUrl = "";
    
    requestAnimationFrame(tick);
    
  } catch (err) {
    console.error("Error accessing camera:", err);
    alert("Camera access denied.");
  }
}

function stopScan() {
  isScanning = false;
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  scannerBlock.classList.remove('scanning');
  scannerBlock.classList.remove('pulsating');
  
  resultBar.classList.remove('detected');
  
  if (context && canvas) {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }
}

scannerBlock.addEventListener('click', () => {
  if (!isScanning) {
    startScan();
    return;
  }
  if (isScanning && detectedUrl) {
    window.open(detectedUrl, '_blank');
    return;
  }
  stopScan();
});