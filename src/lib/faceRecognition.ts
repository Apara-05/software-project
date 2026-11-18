import * as faceapi from 'face-api.js';
import type { FaceDescriptorRecord } from '../types';

export type ModelLoadState = 'idle' | 'loading' | 'ready' | 'error';

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

const MODEL_URL = '/models';

export async function ensureFaceModelsLoaded(): Promise<void> {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
  })().catch((err) => {
    loadingPromise = null;
    throw err;
  });

  return loadingPromise;
}

export function areFaceModelsLoaded(): boolean {
  return modelsLoaded;
}

export interface DetectedFaceResult {
  box: { x: number; y: number; width: number; height: number };
  score: number;
  landmarks: faceapi.FaceLandmarks68;
  descriptor: Float32Array;
}

export async function detectSingleFaceWithDescriptor(
  video: HTMLVideoElement,
): Promise<DetectedFaceResult | null> {
  if (!modelsLoaded) {
    await ensureFaceModelsLoaded();
  }
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    return null;
  }

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.5,
  });

  const detection = await faceapi
    .detectSingleFace(video, options)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;

  return {
    box: {
      x: detection.detection.box.x,
      y: detection.detection.box.y,
      width: detection.detection.box.width,
      height: detection.detection.box.height,
    },
    score: detection.detection.score,
    landmarks: detection.landmarks,
    descriptor: detection.descriptor,
  };
}

export async function detectAllFacesWithDescriptors(
  video: HTMLVideoElement,
): Promise<DetectedFaceResult[]> {
  if (!modelsLoaded) {
    await ensureFaceModelsLoaded();
  }
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    return [];
  }

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.5,
  });

  const detections = await faceapi
    .detectAllFaces(video, options)
    .withFaceLandmarks()
    .withFaceDescriptors();

  return detections.map((det) => ({
    box: {
      x: det.detection.box.x,
      y: det.detection.box.y,
      width: det.detection.box.width,
      height: det.detection.box.height,
    },
    score: det.detection.score,
    landmarks: det.landmarks,
    descriptor: det.descriptor,
  }));
}

export function averageDescriptors(descriptors: Float32Array[]): number[] {
  if (descriptors.length === 0) {
    throw new Error('At least one face descriptor sample is required.');
  }
  const len = descriptors[0].length;
  const avg = new Array<number>(len).fill(0);
  for (const desc of descriptors) {
    for (let i = 0; i < len; i += 1) {
      avg[i] += desc[i];
    }
  }
  for (let i = 0; i < len; i += 1) {
    avg[i] = Number((avg[i] / descriptors.length).toFixed(6));
  }
  return avg;
}

export interface DescriptorMatchResult {
  matched: boolean;
  record: FaceDescriptorRecord | null;
  distance: number;
}

export function findBestDescriptorMatch(
  liveDescriptor: Float32Array,
  registered: FaceDescriptorRecord[],
  threshold: number,
): DescriptorMatchResult {
  let bestRecord: FaceDescriptorRecord | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const item of registered) {
    if (!Array.isArray(item.descriptor) || item.descriptor.length !== 128) continue;
    const distance = faceapi.euclideanDistance(
      liveDescriptor,
      new Float32Array(item.descriptor),
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      bestRecord = item;
    }
  }

  if (bestRecord && bestDistance <= threshold) {
    return {
      matched: true,
      record: bestRecord,
      distance: Number(bestDistance.toFixed(4)),
    };
  }

  return {
    matched: false,
    record: bestRecord,
    distance: Number.isFinite(bestDistance) ? Number(bestDistance.toFixed(4)) : 1.0,
  };
}

export interface OverlayBox {
  box: { x: number; y: number; width: number; height: number };
  label: string;
  matched: boolean;
  landmarks?: faceapi.FaceLandmarks68;
}

export function drawFaceOverlays(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  overlays: OverlayBox[],
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const displayWidth = video.videoWidth;
  const displayHeight = video.videoHeight;
  if (displayWidth === 0 || displayHeight === 0) return;

  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const item of overlays) {
    const { x, y, width, height } = item.box;
    const strokeColor = item.matched ? '#16a34a' : '#dc2626';
    const fillBg = item.matched ? 'rgba(22, 163, 74, 0.9)' : 'rgba(220, 38, 38, 0.9)';

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x, y, width, height);

    if (item.landmarks) {
      ctx.fillStyle = item.matched ? 'rgba(56, 189, 248, 0.85)' : 'rgba(248, 113, 113, 0.85)';
      for (const pt of item.landmarks.positions) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.font = '600 13px "DM Sans", system-ui, sans-serif';
    const textWidth = ctx.measureText(item.label).width;
    const labelY = y > 28 ? y - 24 : y + height + 2;
    ctx.fillStyle = fillBg;
    ctx.fillRect(x, labelY, textWidth + 16, 22);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(item.label, x + 8, labelY + 15);
  }
}
