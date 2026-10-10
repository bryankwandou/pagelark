import { Buffer } from 'buffer';
import { Connection, PublicKey, Transaction, TransactionInstruction, clusterApiUrl } from '@solana/web3.js';

// Proof stamps: the SHA-256 of an exported PDF is written into a Memo
// instruction on Solana devnet, signed by the user's own wallet. The file
// itself never leaves the device; only the 64-char hash goes on chain.
// No server key exists anywhere in this app.

export const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
export const conn = new Connection(clusterApiUrl('devnet'), 'confirmed');
const PREFIX = 'pagelark:v1:';

type Provider = {
  isPhantom?: boolean;
  publicKey?: PublicKey;
  connect: () => Promise<{ publicKey: PublicKey }>;
  signAndSendTransaction: (tx: Transaction) => Promise<{ signature: string }>;
};

export function getProvider(): Provider | null {
  const w = window as unknown as { phantom?: { solana?: Provider }; solana?: Provider };
  return w.phantom?.solana ?? w.solana ?? null;
}

export async function stampHash(hash: string): Promise<string> {
  const p = getProvider();
  if (!p) throw new Error('NO_WALLET');
  const { publicKey } = await p.connect();
  const ix = new TransactionInstruction({
    programId: MEMO_PROGRAM,
    keys: [{ pubkey: publicKey, isSigner: true, isWritable: false }],
    data: Buffer.from(PREFIX + hash, 'utf8'),
  });
  const tx = new Transaction().add(ix);
  tx.feePayer = publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  const { signature } = await p.signAndSendTransaction(tx);
  await conn.confirmTransaction(signature, 'confirmed');
  return signature;
}

/** Read a stamp back from chain and return the hash and signer it carries. */
export async function readStamp(sig: string): Promise<{ hash: string; signer: string; time: number | null } | null> {
  const tx = await conn.getParsedTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
  if (!tx) return null;
  for (const ix of tx.transaction.message.instructions) {
    if ('parsed' in ix && ix.programId.equals(MEMO_PROGRAM) && typeof ix.parsed === 'string' && ix.parsed.startsWith(PREFIX)) {
      return {
        hash: ix.parsed.slice(PREFIX.length),
        signer: tx.transaction.message.accountKeys.find((k) => k.signer)?.pubkey.toBase58() ?? '',
        time: tx.blockTime ?? null,
      };
    }
  }
  return null;
}

export { explorer } from './explorer';
