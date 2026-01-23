const env = import.meta.env;

export const APP_VERSION = env.VITE_APP_VERSION ?? "1.82";
export const APP_BRANCH = env.VITE_APP_BRANCH ?? "fase-8b-visitas-agenda-gcal";
export const APP_COMMIT = env.VITE_APP_COMMIT ?? "dev";
