// Shared between playwright.config.js (which starts these servers) and any
// spec that needs to talk to the isolated backend directly (seeding a Log
// Lens tab via its API rather than the file-picker UI, for example).
export const SERVER_PORT = 7791;
export const CLIENT_PORT = 5191;
export const SERVER_URL = `http://localhost:${SERVER_PORT}`;
export const CLIENT_URL = `http://localhost:${CLIENT_PORT}`;
