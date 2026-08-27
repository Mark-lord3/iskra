import { useEffect, useRef, useState } from "react";

interface BarcodeResult { rawValue: string }
interface BarcodeDetectorLike { detect(source: CanvasImageSource): Promise<BarcodeResult[]> }
interface BarcodeDetectorConstructor { new (options: { formats: string[] }): BarcodeDetectorLike }

function readToken(value: string) {
  try {
    const url = new URL(value);
    return { zoneId: url.searchParams.get("zoneId"), token: url.searchParams.get("token") };
  } catch {
    try {
      const valueObject = JSON.parse(value) as { zoneId?: string; token?: string };
      return { zoneId: valueObject.zoneId || null, token: valueObject.token || null };
    } catch {
      return { zoneId: null, token: null };
    }
  }
}

export function QrZoneScanner({ onScan, onClose }: { onScan: (zoneId: string, token?: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState("");
  onScanRef.current = onScan;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector) {
      setError("QR scanning is not supported by this browser. Choose your nearby area instead.");
      return;
    }
    const detector = new Detector({ formats: ["qr_code"] });
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((camera) => {
        stream = camera;
        if (!videoRef.current) return;
        videoRef.current.srcObject = camera;
        return videoRef.current.play();
      })
      .then(() => {
        const inspect = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const [result] = await detector.detect(videoRef.current);
            if (result) {
              const parsed = readToken(result.rawValue);
              if (parsed.zoneId) {
                stopped = true;
                onScanRef.current(parsed.zoneId, parsed.token || undefined);
                return;
              }
              setError("That QR code is not an ISKRA venue marker.");
            }
          } catch {
            // Some browsers throw while the video frame is still initializing.
          }
          frame = requestAnimationFrame(inspect);
        };
        frame = requestAnimationFrame(inspect);
      })
      .catch(() => setError("Camera access is off. Allow camera access or choose your nearby area."));

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="scanner" role="dialog" aria-modal="true" aria-label="Scan venue zone QR code">
      <div className="scanner__topline">
        <span>POINT AT AN ISKRA MARKER</span>
        <button type="button" onClick={onClose} aria-label="Close scanner">Close</button>
      </div>
      <div className="scanner__viewport">
        <video ref={videoRef} muted playsInline />
        <div className="scanner__reticle" aria-hidden="true" />
      </div>
      {error && <p className="scanner__error">{error}</p>}
    </div>
  );
}
