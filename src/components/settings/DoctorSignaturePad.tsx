"use client";

import { useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { FaPenToSquare, FaTrash } from "react-icons/fa6";

type DoctorSignaturePadProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

type Point = { x: number; y: number };

function cropSignatureCanvas(canvas: HTMLCanvasElement, padding = 20) {
  const context = canvas.getContext("2d");
  if (!context) return canvas.toDataURL("image/png");

  const { width, height } = canvas;
  const pixels = context.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3];
      if (alpha <= 8) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0 || maxY < 0) {
    return "";
  }

  const leftPadding = Math.max(8, Math.floor(padding * 0.7));
  const rightPadding = Math.max(8, Math.floor(padding * 0.7));
  const topPadding = Math.max(padding + 6, 18);
  const bottomPadding = 0;
  const cropX = Math.max(0, minX - leftPadding);
  const cropY = Math.max(0, minY - topPadding);
  const cropWidth = Math.min(width - cropX, maxX - minX + leftPadding + rightPadding + 1);
  const cropHeight = Math.min(height - cropY, maxY - minY + topPadding + bottomPadding + 1);

  const output = document.createElement("canvas");
  output.width = Math.max(1, cropWidth);
  output.height = Math.max(1, cropHeight);
  const outputContext = output.getContext("2d");
  if (!outputContext) {
    return canvas.toDataURL("image/png");
  }
  outputContext.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  return output.toDataURL("image/png");
}

export function DoctorSignaturePad({ value, onChange, disabled = false }: DoctorSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const valueRef = useRef(value);

  function prepareCanvas(canvas: HTMLCanvasElement) {
    const bounds = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(bounds.width * ratio));
    canvas.height = Math.max(1, Math.round(bounds.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineWidth = 2.6;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111827";
    context.clearRect(0, 0, bounds.width, bounds.height);
  }

  function restoreValue(canvas: HTMLCanvasElement, dataUrl: string) {
    const context = canvas.getContext("2d");
    if (!context) return;
    const bounds = canvas.getBoundingClientRect();
    context.clearRect(0, 0, bounds.width, bounds.height);
    if (!dataUrl) return;
    const image = new Image();
    image.onload = () => {
      if (canvasRef.current !== canvas || valueRef.current !== dataUrl) return;
      const scale = Math.min(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight);
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      const drawX = (bounds.width - drawWidth) / 2;
      const drawY = (bounds.height - drawHeight) / 2;
      context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    };
    image.src = dataUrl;
  }

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  }

  function drawPoint(point: Point | null) {
    const canvas = canvasRef.current;
    if (!canvas || !point || disabled) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const lastPoint = lastPointRef.current;
    if (!lastPoint) {
      context.beginPath();
      context.arc(point.x, point.y, 1.25, 0, Math.PI * 2);
      context.fillStyle = "#111827";
      context.fill();
      lastPointRef.current = point;
      return;
    }
    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPointRef.current = point;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    valueRef.current = value;
    const sync = () => {
      prepareCanvas(canvas);
      restoreValue(canvas, value);
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [value]);

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const canvas = canvasRef.current;
    const point = pointFromEvent(event);
    if (!canvas || !point) return;
    drawingRef.current = true;
    lastPointRef.current = null;
    canvas.setPointerCapture(event.pointerId);
    drawPoint(point);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || disabled) return;
    drawPoint(pointFromEvent(event));
  }

  function finishStroke(event?: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    if (event && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    const nextValue = canvas.toDataURL("image/png");
    valueRef.current = nextValue;
    onChange(nextValue);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas || disabled) return;
    const context = canvas.getContext("2d");
    const bounds = canvas.getBoundingClientRect();
    context?.clearRect(0, 0, bounds.width, bounds.height);
    lastPointRef.current = null;
    drawingRef.current = false;
    valueRef.current = "";
    onChange("");
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Doctor signature</p>
          <p className="mt-1 text-sm text-neutral-600">Draw the saved signature once and use it on every prescription.</p>
        </div>
        <button
          type="button"
          onClick={clearSignature}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FaTrash className="h-3 w-3" aria-hidden="true" />
          Clear
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <canvas
          ref={canvasRef}
          width={520}
          height={180}
          aria-label="Doctor signature pad"
          className={`h-[180px] w-full touch-none ${disabled ? "cursor-not-allowed" : "cursor-crosshair"}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        <span className="inline-flex items-center gap-1.5 font-semibold text-neutral-600">
          <FaPenToSquare className="h-3 w-3" aria-hidden="true" />
          Click Save Changes after drawing to store the signature.
        </span>
        {value ? <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-semibold text-neutral-700">Ready</span> : null}
      </div>
    </section>
  );
}
