import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();

export async function signJWT(secret: string) {
  return new SignJWT({ sub: "admin" })  
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d") //  过期时间设置为7天
    .sign(encoder.encode(secret));
}

export async function verifyJWT(token: string, secret: string) {
  return jwtVerify(token, encoder.encode(secret));
}
