import { weapi, eapi } from "./netease-crypto";

const BASE_URL = "https://music.163.com";
const EAPI_BASE_URL = "https://interface3.music.163.com";

const PC_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const MOBILE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.27";

function getRandomDomesticIp(): string {
  return `113.108.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

function createSecretKey(size: number): string {
  const choice = "012345679abcdef".split("");
  let result = "";
  for (let i = 0; i < size; i++) {
    result += choice[Math.floor(Math.random() * choice.length)];
  }
  return result;
}

function buildVisitorCookie(): string {
  const nuid = createSecretKey(32);
  const nnid = `${nuid},${Date.now()}`;
  return `_ntes_nuid=${nuid}; _ntes_nnid3=${nnid}; NMTID=0;`;
}

function cleanCookie(cookieStr: string | null): string {
  if (!cookieStr) return "";
  const parts = cookieStr.split(/[,;]\s*/);
  const cookieMap = new Map<string, string>();
  const ignoredKeys = new Set([
    "expires",
    "max-age",
    "domain",
    "path",
    "httponly",
    "secure",
    "samesite",
    "priority",
  ]);

  for (const part of parts) {
    const match = part.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (key && !ignoredKeys.has(key.toLowerCase())) cookieMap.set(key, value);
    }
  }
  return Array.from(cookieMap.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function buildCookie(rawCookie: string = ""): string {
  let finalCookie = rawCookie.trim();

  if (!finalCookie) {
    finalCookie = buildVisitorCookie();
  } else if (!finalCookie.includes("=")) {
    finalCookie = `MUSIC_U=${finalCookie}`;
  } else {
    finalCookie = cleanCookie(finalCookie);
  }

  return `os=pc; appver=2.9.7; mode=31; ${finalCookie}`;
}

async function requestWeapi<T = any>(
  url: string,
  data: any,
  cookie: string = ""
) {
  const encData = await weapi(data);
  const params = new URLSearchParams(encData as any).toString();
  const fakeIp = getRandomDomesticIp();

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": PC_USER_AGENT,
    Referer: BASE_URL,
    Origin: BASE_URL,
    "X-Real-IP": fakeIp,
    "X-Forwarded-For": fakeIp,
    Cookie: buildCookie(cookie),
  };

  const response = await fetch(url, { method: "POST", headers, body: params });

  if (!response.ok) {
    throw new Error(`NetEase WEAPI Error: ${response.status}`);
  }

  const setCookie = response.headers.get("set-cookie");
  const cleanedCookie = cleanCookie(setCookie);
  const json = await response.json();
  return { data: json as T, cookie: cleanedCookie };
}

async function requestEapi<T = any>(
  url: string,
  path: string,
  data: any,
  cookie: string = ""
) {
  const encData = await eapi(path, data);
  const params = new URLSearchParams(encData as any).toString();
  const fakeIp = getRandomDomesticIp();

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": MOBILE_USER_AGENT,
    Referer: BASE_URL,
    Origin: BASE_URL,
    "X-Real-IP": fakeIp,
    "X-Forwarded-For": fakeIp,
    Cookie: buildCookie(cookie),
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: params,
    cf: { cacheTtl: 0, cacheEverything: false },
  } as any);

  if (!response.ok) {
    throw new Error(`NetEase EAPI Error: ${response.status}`);
  }

  const json = await response.json();
  return { data: json as T };
}

export {
  BASE_URL,
  EAPI_BASE_URL,
  PC_USER_AGENT,
  MOBILE_USER_AGENT,
  getRandomDomesticIp,
  createSecretKey,
  buildVisitorCookie,
  cleanCookie,
  buildCookie,
  requestWeapi,
  requestEapi,
};
