import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Camera } from 'lucide-react';
import { Button } from '../../../ui';

function cameraErrorMessage(e: unknown): string {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'No hay permiso para usar la cámara. Actívalo en los ajustes de Android o elige una foto de la galería.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No se encontró una cámara en este dispositivo.';
  }
  if (name === 'NotReadableError') {
    return 'La cámara está ocupada por otra app. Ciérrala e inténtalo de nuevo.';
  }
  return `No se pudo abrir la cámara: ${e instanceof Error ? e.message : String(e)}`;
}

/**
 * Vista previa de la cámara trasera dentro de la app. Evita lanzar la app de cámara del sistema,
 * durante la cual Android puede cerrar Catpresupuesto y perder la foto.
 */
export function CameraCapture(props: {
  onCapture(file: File): void;
  onCancel(): void;
  onError(message: string): void;
}): ReactNode {
  const { onCapture, onCancel, onError } = props;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 2560 },
          height: { ideal: 1920 },
        },
      })
      .then(async (s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = videoRef.current;
        if (video === null) return;
        video.srcObject = s;
        await video.play();
        if (!cancelled) setReady(true);
      })
      .catch((e: unknown) => {
        if (!cancelled) onErrorRef.current(cameraErrorMessage(e));
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function capture(): void {
    const video = videoRef.current;
    if (video === null || video.videoWidth === 0) return;
    setCapturing(true);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      onError('No se pudo capturar la foto.');
      return;
    }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob === null) {
          onError('No se pudo capturar la foto.');
          return;
        }
        onCapture(new File([blob], 'boleta.jpg', { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92,
    );
  }

  return (
    <div className="scan-camera">
      <video ref={videoRef} className="scan-camera__video" playsInline muted />
      {!ready ? <p className="scan-hint">Abriendo cámara…</p> : null}
      <Button block disabled={!ready} loading={capturing} onClick={capture}>
        <Camera size={20} />
        Capturar
      </Button>
      <Button block variant="ghost" onClick={onCancel}>
        Cancelar
      </Button>
    </div>
  );
}
