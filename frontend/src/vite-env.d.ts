/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PAIR_ADDRESS: string;
  readonly VITE_FACTORY_ADDRESS: string;
  readonly VITE_MORPH_ADDRESS: string;
  readonly VITE_MUSD_ADDRESS: string;
  readonly VITE_TOKEN_LIST: string;
  readonly VITE_PAIR_LIST: string;
  readonly VITE_TOKEN_ADDRESSES: string;
  readonly VITE_PUBLIC_TOKEN_LIST: string;
  readonly VITE_RELAYER_VAULT_ADDRESS: string;
  readonly VITE_CHAIN_ID: string;
  readonly VITE_CHAIN_NAME: string;
  readonly VITE_RPC_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
