'use client';

import {useEffect, useRef, useState, type RefObject} from 'react';
import {clampCameraZoom, fitCameraFrame} from '@/lib/camera-zoom';

export default function CameraPreview({videoRef, zoomRef, photoUrl, hasPhoto, ready, disabled, error}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  zoomRef: RefObject<number>;
  photoUrl: string;
  hasPhoto: boolean;
  ready: boolean;
  disabled: boolean;
  error: string;
}) {
  const view = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [frame, setFrame] = useState({width: 0, height: 0});

  function changeZoom(value: number) {
    zoomRef.current = clampCameraZoom(value);
    setZoom(zoomRef.current);
  }

  useEffect(() => {
    const element = view.current, video = videoRef.current;
    if (!element || !video) return;
    const resize = () => setFrame(fitCameraFrame(element.clientWidth, element.clientHeight, video.videoWidth, video.videoHeight));
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    video.addEventListener('loadedmetadata', resize);
    video.addEventListener('resize', resize);
    resize();
    return () => {
      observer.disconnect();
      video.removeEventListener('loadedmetadata', resize);
      video.removeEventListener('resize', resize);
    };
  }, [videoRef]);

  useEffect(() => {
    const element = view.current;
    const dialog = element?.closest('[role="dialog"]');
    if (!element || !dialog) return;
    let pinch: {distance: number; zoom: number} | null = null;
    const distance = (touches: TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const begin = (event: TouchEvent) => {
      if (event.touches.length !== 2 || disabled || hasPhoto) { pinch = null; return; }
      if (event.cancelable) event.preventDefault();
      pinch = {distance: Math.max(1, distance(event.touches)), zoom: zoomRef.current};
    };
    const move = (event: TouchEvent) => {
      if (event.touches.length !== 2 || disabled || hasPhoto) { pinch = null; return; }
      if (event.cancelable) event.preventDefault();
      if (!pinch) { begin(event); return; }
      changeZoom(pinch.zoom * distance(event.touches) / pinch.distance);
    };
    const end = () => { pinch = null; };
    // Non-passive listeners also cover Safari's native gesture events. Their
    // scope is only this camera dialog; normal page zoom remains accessible.
    const preventGesture = (event: Event) => { if (event.cancelable) event.preventDefault(); };
    const preventPagePinch = (event: Event) => {
      if ((event as TouchEvent).touches.length > 1) preventGesture(event);
    };
    element.addEventListener('touchstart', begin, {passive: false});
    element.addEventListener('touchmove', move, {passive: false});
    element.addEventListener('touchend', end);
    element.addEventListener('touchcancel', end);
    dialog.addEventListener('touchstart', preventPagePinch, {passive: false});
    dialog.addEventListener('touchmove', preventPagePinch, {passive: false});
    for (const name of ['gesturestart', 'gesturechange', 'gestureend']) dialog.addEventListener(name, preventGesture, {passive: false});
    return () => {
      element.removeEventListener('touchstart', begin);
      element.removeEventListener('touchmove', move);
      element.removeEventListener('touchend', end);
      element.removeEventListener('touchcancel', end);
      dialog.removeEventListener('touchstart', preventPagePinch);
      dialog.removeEventListener('touchmove', preventPagePinch);
      for (const name of ['gesturestart', 'gesturechange', 'gestureend']) dialog.removeEventListener(name, preventGesture);
    };
  }, [disabled, hasPhoto, zoomRef]);

  return <div ref={view} className="capture-view">
    <div className="capture-live-frame" style={{...frame, visibility: hasPhoto ? 'hidden' : 'visible'}}>
      <video ref={videoRef} autoPlay playsInline muted style={{transform: `scale(${zoom})`}}/>
    </div>
    {photoUrl && <img src={photoUrl} alt="Ditt nye bilde før innsending"/>}
    {!ready && !error && <p className="capture-loading" role="status">Åpner kameraet …</p>}
    {ready && !hasPhoto && <div className="capture-zoom" role="group" aria-label="Digital kamerazoom">
      <button type="button" aria-label="Zoom ut" disabled={disabled || zoom <= 1} onClick={() => changeZoom(zoomRef.current - .25)}>−</button>
      <button type="button" aria-label={`Zoom ${zoom.toFixed(1)} ganger. Tilbakestill zoom`} disabled={disabled} onClick={() => changeZoom(1)}>{zoom.toFixed(1)}×</button>
      <button type="button" aria-label="Zoom inn" disabled={disabled || zoom >= 4} onClick={() => changeZoom(zoomRef.current + .25)}>+</button>
    </div>}
  </div>;
}
