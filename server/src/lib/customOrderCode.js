import crypto from 'node:crypto';

export const normalizeCustomOrderCode=value=>String(value||'').trim().toUpperCase().replace(/\s+/g,'');
export const hashCustomOrderCode=value=>crypto.createHash('sha256').update(normalizeCustomOrderCode(value)).digest('hex');

const key=()=>{
  const secret=String(process.env.CUSTOM_ORDER_ENCRYPTION_SECRET||process.env.VISITOR_SIGNING_SECRET||'');
  if(process.env.NODE_ENV==='production'&&secret.length<32)throw new Error('CUSTOM_ORDER_ENCRYPTION_SECRET or VISITOR_SIGNING_SECRET must contain at least 32 characters.');
  return crypto.createHash('sha256').update(secret||'development-only-custom-order-key').digest();
};

export function generateCustomOrderCode(){
  return `ISKRA-${crypto.randomBytes(12).toString('base64url').toUpperCase()}`;
}

export function protectCustomOrderCode(raw){
  const code=normalizeCustomOrderCode(raw);
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);
  const ciphertext=Buffer.concat([cipher.update(code,'utf8'),cipher.final()]);
  return {codeHash:hashCustomOrderCode(code),codeCiphertext:ciphertext.toString('base64url'),codeIv:iv.toString('base64url'),codeTag:cipher.getAuthTag().toString('base64url'),codeSuffix:code.slice(-6)};
}

export function revealCustomOrderCode(record){
  const decipher=crypto.createDecipheriv('aes-256-gcm',key(),Buffer.from(record.codeIv,'base64url'));
  decipher.setAuthTag(Buffer.from(record.codeTag,'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(record.codeCiphertext,'base64url')),decipher.final()]).toString('utf8');
}
