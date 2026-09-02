import { BrowserProvider, Contract, JsonRpcSigner } from 'ethers';
import { createInstance, SepoliaConfig } from '@zama-fhe/relayer-sdk/web';

export const TESTNET_CHAIN_ID = 11155111;
export const LOCAL_CHAIN_ID = 31337;

const pairAbi = [
  'function token0() view returns (address)',
  'function swapExactInput(bool,bytes32,bytes32,bytes,bytes) returns (bytes32)',
];

const erc7984Abi = ['function setOperator(address,uint48)'];

declare global {
  interface Window {
    ethereum?: {
      request(args: { method: string; params?: unknown[] }): Promise<unknown>;
    };
  }
}

export const config = {
  pairAddress: import.meta.env.VITE_PAIR_ADDRESS ?? '',
  factoryAddress: import.meta.env.VITE_FACTORY_ADDRESS ?? '',
  token0Address: import.meta.env.VITE_MORPH_ADDRESS ?? '',
  token1Address: import.meta.env.VITE_MUSD_ADDRESS ?? '',
  vaultAddress: import.meta.env.VITE_RELAYER_VAULT_ADDRESS ?? '',
  chainId: Number(import.meta.env.VITE_CHAIN_ID || TESTNET_CHAIN_ID),
  chainName: import.meta.env.VITE_CHAIN_NAME || 'Sepolia Testnet',
  rpcUrl: import.meta.env.VITE_RPC_URL || 'https://rpc.sepolia.org',
};

export type DeployedToken = { name: string; symbol: string; address: string };

export const deployedTokens: DeployedToken[] = (() => {
  try {
    return JSON.parse(import.meta.env.VITE_TOKEN_LIST || '[]') as DeployedToken[];
  } catch {
    return [];
  }
})();

export const publicTokens: DeployedToken[] = (() => {
  try {
    return JSON.parse(import.meta.env.VITE_PUBLIC_TOKEN_LIST || '[]') as DeployedToken[];
  } catch {
    return [];
  }
})();

const deployedPairs: Record<string, string> = (() => {
  try {
    return JSON.parse(import.meta.env.VITE_PAIR_LIST || '{}') as Record<string, string>;
  } catch {
    return {};
  }
})();

function getEthereum() {
  if (!window.ethereum) throw new Error('Install a browser wallet to continue.');
  return window.ethereum;
}

async function useConfiguredNetwork() {
  const ethereum = getEthereum();
  const chainId = await ethereum.request({ method: 'eth_chainId' });
  const configuredChainId = `0x${config.chainId.toString(16)}`;
  if (chainId === configuredChainId) return;
  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: configuredChainId }],
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 4902) throw new Error(`Switch your wallet to ${config.chainName} to use Morphex.`);
    await ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: configuredChainId,
        chainName: config.chainName,
        nativeCurrency: { name: config.chainName === 'Hardhat Local' ? 'Hardhat Ether' : 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: [config.rpcUrl],
        ...(config.chainId === TESTNET_CHAIN_ID ? { blockExplorerUrls: ['https://sepolia.etherscan.io'] } : {}),
      }],
    });
  }
}

export function hasContractConfig() {
  return [config.factoryAddress, config.pairAddress, config.token0Address, config.token1Address]
    .every((address) => /^0x[\da-f]{40}$/i.test(address));
}

function pairKey(tokenA: string, tokenB: string) {
  return [tokenA.toLowerCase(), tokenB.toLowerCase()].sort().join('-');
}

export async function connectWallet(): Promise<{ signer: JsonRpcSigner; address: string }> {
  const ethereum = getEthereum();
  await useConfiguredNetwork();
  const provider = new BrowserProvider(ethereum);
  await provider.send('eth_requestAccounts', []);
  const signer = await provider.getSigner();
  return { signer, address: await signer.getAddress() };
}

export async function submitPrivateSwap(
  signer: JsonRpcSigner,
  address: string,
  zeroForOne: boolean,
  amountIn: bigint,
  amountOutTarget: bigint,
  sellTokenAddress: string,
  buyTokenAddress: string,
) {
  if (!hasContractConfig()) throw new Error('Deploy the Sepolia testnet contracts before swapping.');
  await useConfiguredNetwork();
  const fhevm = await createInstance({ ...SepoliaConfig, network: getEthereum() });
  const pairAddress = deployedPairs[pairKey(sellTokenAddress, buyTokenAddress)] || config.pairAddress;
  const pair = new Contract(pairAddress, pairAbi, signer);
  const pairToken0 = await pair.token0();
  const inputToken = new Contract(sellTokenAddress, erc7984Abi, signer);
  const direction = pairToken0.toLowerCase() === sellTokenAddress.toLowerCase();
  await (await inputToken.setOperator(pairAddress, Math.floor(Date.now() / 1000) + 3600)).wait();
  const encryptedInput = await fhevm.createEncryptedInput(config.pairAddress, address).add64(amountIn).encrypt();
  const encryptedOutput = await fhevm.createEncryptedInput(config.pairAddress, address).add64(amountOutTarget).encrypt();
  return pair.swapExactInput(direction, encryptedInput.handles[0], encryptedOutput.handles[0], encryptedInput.inputProof, encryptedOutput.inputProof);
}