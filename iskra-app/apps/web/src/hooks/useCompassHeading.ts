import { useEffect, useState } from "react";

interface DeviceOrientationEventIOS extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

interface DeviceOrientationEventConstructorIOS {
  requestPermission?: () => Promise<"granted" | "denied">;
}

function normalize(degrees: number) {
  return (degrees % 360 + 360) % 360;
}

function shortestTurn(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

export function useCompassHeading() {
  const [heading, setHeading] = useState<number | null>(null);
  const [permission, setPermission] = useState<"prompt" | "granted" | "denied" | "unsupported">("prompt");
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (!listening) return;
    const onOrientation = (rawEvent: DeviceOrientationEvent) => {
      const event = rawEvent as DeviceOrientationEventIOS;
      const next = event.webkitCompassHeading ?? (event.alpha == null ? null : 360 - event.alpha);
      if (next == null || !Number.isFinite(next)) return;
      setHeading((current) => current == null ? normalize(next) : normalize(current + shortestTurn(current, next) * 0.18));
    };
    window.addEventListener("deviceorientation", onOrientation, true);
    return () => window.removeEventListener("deviceorientation", onOrientation, true);
  }, [listening]);

  async function enable() {
    if (!("DeviceOrientationEvent" in window)) {
      setPermission("unsupported");
      return;
    }
    const constructor = DeviceOrientationEvent as unknown as DeviceOrientationEventConstructorIOS;
    try {
      const result = constructor.requestPermission ? await constructor.requestPermission() : "granted";
      setPermission(result);
      setListening(result === "granted");
    } catch {
      setPermission("denied");
    }
  }

  return { heading, permission, enable };
}
