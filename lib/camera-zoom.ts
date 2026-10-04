export function clampCameraZoom(value: number) {
  return Number.isFinite(value) ? Math.min(4, Math.max(1, value)) : 1;
}

// The preview and saved photo both use this centred, aspect-preserving crop.
export function cameraCrop(width: number, height: number, zoom: number) {
  const factor = clampCameraZoom(zoom);
  const sw = width / factor, sh = height / factor;
  return {sx: (width - sw) / 2, sy: (height - sh) / 2, sw, sh};
}

export function fitCameraFrame(width: number, height: number, videoWidth: number, videoHeight: number) {
  if (!width || !height || !videoWidth || !videoHeight) return {width: 0, height: 0};
  const scale = Math.min(width / videoWidth, height / videoHeight);
  return {width: videoWidth * scale, height: videoHeight * scale};
}
