import './style.css'
import jsQR from 'jsqr'

let isScanning = false;
let stream: MediaStream | null = null;
let lastResultStr = "";
let detectedUrl = "";
let notificationRunId = 0;
let activeNotificationAudio: HTMLAudioElement | null = null;

const NOTIFICATION_SOUND_SRC = './bell.wav';
const NOTIFICATION_PLAY_COUNT = 3;

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

function isValidHttpUrl(string: string) {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}

function stopNotificationSequence() {
  notificationRunId += 1;
  if (activeNotificationAudio) {
    activeNotificationAudio.pause();
    activeNotificationAudio.currentTime = 0;
    activeNotificationAudio = null;
  }
}

async function playNotificationOnce(runId: number) {
  if (runId !== notificationRunId) return false;

  const audio = new Audio(NOTIFICATION_SOUND_SRC);
  activeNotificationAudio = audio;

  try {
    await audio.play();
  } catch (err) {
    console.error('Notification play failed:', err);
    if (activeNotificationAudio === audio) {
      activeNotificationAudio = null;
    }
    return false;
  }

  await new Promise<void>((resolve) => {
    const finish = () => resolve();
    audio.addEventListener('ended', finish, { once: true });
    audio.addEventListener('error', finish, { once: true });
  });

  if (activeNotificationAudio === audio) {
    activeNotificationAudio = null;
  }

  return runId === notificationRunId;
}

async function playDetectionNotificationSequence() {
  stopNotificationSequence();
  const runId = notificationRunId;

  for (let i = 0; i < NOTIFICATION_PLAY_COUNT; i += 1) {
    const shouldContinue = await playNotificationOnce(runId);
    if (!shouldContinue) return;
  }
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
      if (isValidHttpUrl(code.data)) {
        
        drawQuad(code.location, "#ff6464");
        
        if (code.data !== lastResultStr) {
          lastResultStr = code.data;
          handleDetection(code.data);
        }
      }
    }
  }
  requestAnimationFrame(tick);
}

function handleDetection(data: string) {
  resultText.textContent = `Tap to open -> ${data}`;
  resultBar.classList.add('detected');
  
  detectedUrl = data;
  scannerBlock.classList.add('pulsating');

  void playDetectionNotificationSequence();
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
  stopNotificationSequence();
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
    stopNotificationSequence();
    window.open(detectedUrl, '_blank');
    stopScan();
    return;
  }
  stopScan();
});