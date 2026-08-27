import { env } from "../config/env";

export type DatingAppConfig = {
  enabled: boolean;
  competitionEnabled: boolean;
  message: string;
};

const closedConfig: DatingAppConfig = {
  enabled: false,
  competitionEnabled: false,
  message: "The ISKRA social room is currently closed."
};
let cached: { value: DatingAppConfig; until: number } | null = null;

export async function getDatingAppConfig() {
  if (cached && cached.until > Date.now()) return cached.value;
  try {
    const response = await fetch(`${env.PROMO_API_URL.replace(/\/$/, "")}/dating-app`, {
      signal: AbortSignal.timeout(2500)
    });
    if (!response.ok) throw new Error(`Promo API returned ${response.status}.`);
    const value = await response.json() as DatingAppConfig;
    cached = {
      value: {
        enabled: Boolean(value.enabled),
        competitionEnabled: Boolean(value.enabled && value.competitionEnabled),
        message: String(value.message || closedConfig.message)
      },
      until: Date.now() + 5000
    };
  } catch {
    cached = { value: closedConfig, until: Date.now() + 5000 };
  }
  return cached.value;
}

export async function requireDatingApp() {
  const config = await getDatingAppConfig();
  if (!config.enabled) throw Object.assign(new Error(config.message), { status: 503 });
  return config;
}
