import * as forge from 'node-forge';

const NONCE = '0CoJUm6Qyw8W8jud';
const PUB_KEY = '010001';
const MODULUS = '00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7';
const EAPI_KEY = 'e82ckenh8dichen8';

function createSecretKey(size: number): string {
  const result = [];
  const choice = '012345679abcdef'.split('');
  for (let i = 0; i < size; i += 1) {
    const index = Math.floor(Math.random() * choice.length);
    result.push(choice[index]);
  }
  return result.join('');
}

function aesEncrypt(text: string, secKey: string, algo: 'AES-CBC' | 'AES-ECB', ivString: string = '0102030405060708'): string {
  const cipher = forge.cipher.createCipher(algo, forge.util.createBuffer(secKey, 'utf8'));
  if (algo === 'AES-CBC') {
      cipher.start({ iv: ivString });
  } else {
      cipher.start({});
  }
  
  cipher.update(forge.util.createBuffer(text, 'utf8'));
  cipher.finish();
  return cipher.output.data; // Binary string
}

function rsaEncrypt(text: string, pubKey: string, modulus: string): string {
  const reversedText = text.split('').reverse().join('');
  const n = new forge.jsbn.BigInteger(modulus, 16);
  const e = new forge.jsbn.BigInteger(pubKey, 16);
  const b = new forge.jsbn.BigInteger(forge.util.bytesToHex(reversedText), 16);
  const enc = b.modPow(e, n).toString(16).padStart(256, '0');
  return enc;
}

export function weapi(object: any) {
  const text = JSON.stringify(object);
  const secKey = createSecretKey(16);
  
  // First encryption
  const enc1 = aesEncrypt(text, NONCE, 'AES-CBC');
  const b64enc1 = forge.util.encode64(enc1);
  
  // Second encryption
  const enc2 = aesEncrypt(b64enc1, secKey, 'AES-CBC');
  const b64enc2 = forge.util.encode64(enc2);
  
  const encSecKey = rsaEncrypt(secKey, PUB_KEY, MODULUS);
  
  return {
    params: b64enc2,
    encSecKey: encSecKey,
  };
}

export function eapi(url: string, object: any) {
  const text = typeof object === 'object' ? JSON.stringify(object) : object;
  const message = `nobody${url}use${text}md5forencrypt`;
  const digest = forge.md5
    .create()
    .update(forge.util.encodeUtf8(message))
    .digest()
    .toHex();
  const data = `${url}-36cd479b6b5-${text}-36cd479b6b5-${digest}`;
  
  const enc = aesEncrypt(data, EAPI_KEY, 'AES-ECB');
  const hex = forge.util.bytesToHex(enc).toUpperCase();

  return {
    params: hex,
  };
}
