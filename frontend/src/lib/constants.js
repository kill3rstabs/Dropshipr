const IS_DEV = false;

// if is dev then url is http://localhost:8000/api else /api only
export const API_BASE_URL = IS_DEV ? "http://localhost:8000/api" : "/api";