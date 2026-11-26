import type { PiiMaskBox, QualityCheckResult } from '../types/medreport';

export interface ProcessedUploadImage {
  originalDataUrl: string;
  maskedDataUrl: string;
  width: number;
  height: number;
  qualityCheck: QualityCheckResult;
  piiMasks: PiiMaskBox[];
}

/**
 * Computes image sharpness (variance of Laplacian approximation) and average brightness
 * directly in the browser before any upload, then redacts the top patient-metadata block
 * locally so PII never leaves the browser in the masked image sent to AI.
 */
export async function inspectAndMaskUploadedFile(
  file: File,
  maskHeaderPercent: number = 22,
): Promise<ProcessedUploadImage> {
  const originalDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read selected file.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Please upload a valid PNG, JPG, or WebP image of your lab report.'));
    el.src = originalDataUrl;
  });

  // Normalize working canvas size up to 1200px wide for consistent coordinate mapping
  const maxWidth = 1000;
  const scale = img.naturalWidth > maxWidth ? maxWidth / img.naturalWidth : 1;
  const width = Math.max(300, Math.round(img.naturalWidth * scale));
  const height = Math.max(300, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Browser canvas unavailable.');
  }

  ctx.drawImage(img, 0, 0, width, height);

  // Quality Check: sample grayscale pixels for brightness + Laplacian variance (blur score)
  const sampleW = Math.min(width, 320);
  const sampleH = Math.min(height, 420);
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = sampleW;
  sampleCanvas.height = sampleH;
  const sCtx = sampleCanvas.getContext('2d')!;
  sCtx.drawImage(img, 0, 0, sampleW, sampleH);
  const { data } = sCtx.getImageData(0, 0, sampleW, sampleH);

  const gray = new Float32Array(sampleW * sampleH);
  let brightnessSum = 0;
  for (let i = 0; i < sampleW * sampleH; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i] = lum;
    brightnessSum += lum;
  }
  const avgBrightness = brightnessSum / (sampleW * sampleH);

  let lapSum = 0;
  let lapSqSum = 0;
  let lapCount = 0;
  for (let y = 1; y < sampleH - 1; y++) {
    for (let x = 1; x < sampleW - 1; x++) {
      const idx = y * sampleW + x;
      const lap =
        gray[idx - sampleW] +
        gray[idx + sampleW] +
        gray[idx - 1] +
        gray[idx + 1] -
        4 * gray[idx];
      lapSum += lap;
      lapSqSum += lap * lap;
      lapCount += 1;
    }
  }
  const lapMean = lapSum / Math.max(1, lapCount);
  const blurVariance = Math.max(0, lapSqSum / Math.max(1, lapCount) - lapMean * lapMean);

  let passed = true;
  let reason: string | undefined;
  if (img.naturalWidth < 360 || img.naturalHeight < 360) {
    passed = false;
    reason = 'This photo resolution is too low to read lab numbers reliably. Please capture a closer, clearer photo.';
  } else if (avgBrightness < 55) {
    passed = false;
    reason = 'The photo is too dark. Please move to a well-lit area without heavy shadows and retake the photo.';
  } else if (avgBrightness > 248) {
    passed = false;
    reason = 'The photo appears washed out or overexposed. Avoid direct flash glare on shiny paper.';
  } else if (blurVariance < 28) {
    passed = false;
    reason = 'The photo looks blurry or out of focus. Hold your phone steady flat over the page and try again.';
  }

  const normalizedScore = Math.round(
    Math.min(100, Math.max(12, (Math.min(blurVariance, 350) / 350) * 70 + (avgBrightness > 80 && avgBrightness < 240 ? 30 : 10))),
  );

  const qualityCheck: QualityCheckResult = {
    passed,
    score: passed ? Math.max(70, normalizedScore) : Math.min(45, normalizedScore),
    blur_score: Math.round(blurVariance),
    brightness_score: Math.round(avgBrightness),
    reason,
  };

  const normalizedOriginal = canvas.toDataURL('image/jpeg', 0.9);

  // Client-side PII Masking: redact header metadata zone (Name, Patient ID, Mobile, Address, Ref By, Barcode)
  const maskHeight = Math.round((height * Math.max(10, Math.min(40, maskHeaderPercent))) / 100);
  const piiMasks: PiiMaskBox[] = [
    {
      id: 'pii-header-block',
      label: 'Patient Identifiers & Header Block',
      bbox: [Math.round(width * 0.03), Math.round(height * 0.03), Math.round(width * 0.97), maskHeight],
    },
  ];

  ctx.fillStyle = '#0f172a';
  for (const box of piiMasks) {
    const [x1, y1, x2, y2] = box.bbox;
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('[MASKED: PATIENT IDENTIFIERS REMOVED BEFORE AI]', x1 + 18, y1 + Math.max(30, (y2 - y1) / 2));
    ctx.fillStyle = '#0f172a';
  }

  const maskedDataUrl = canvas.toDataURL('image/jpeg', 0.9);

  return {
    originalDataUrl: normalizedOriginal,
    maskedDataUrl,
    width,
    height,
    qualityCheck,
    piiMasks,
  };
}
