import { BrowserProvider, Contract, JsonRpcSigner, formatEther, formatUnits } from 'ethers';
import { createInstance, initSDK, SepoliaConfigV2 } from '@zama-fhe/relayer-sdk/web';
import tfheWasmUrl from '../node_modules/@zama-fhe/relayer-sdk/lib/tfhe_bg.wasm?url';
import kmsWasmUrl from '../node_modules/@zama-fhe/relayer-sdk/lib/kms_lib_bg.wasm?url';

export const TESTNET_CHAIN_ID = 11155111;
export const LOCAL_CHAIN_ID = 31337;

const pairAbi = [
  'function token0() view returns (address)',
  'function swapExactInput(bool,bytes32,bytes32,bytes,bytes) returns (bytes32)',
];

const erc7984Abi = [
  'function setOperator(address,uint48)',
  'function underlyingToken() view returns (address)',
  'function relayerBurnRequest(bytes32,bytes,uint256) returns (uint256)',
];
const erc20BalanceAbi = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];
const confidentialBalanceAbi = [
  'function confidentialBalanceOf(address) view returns (bytes32)',
  'function decimals() view returns (uint8)',
];
const vaultWithdrawalAbi = [
  'function getWithdrawalRequest(uint256) view returns (address user,address token,uint256 amount,uint256 requestedAt,bool fulfilled,bool escaped)',
  'function claimEscapedWithdrawal(uint256)',
];

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
  rpcUrl: import.meta.env.VITE_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
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

let sdkInitialization: Promise<boolean> | undefined;

function initializeFheSdk() {
  sdkInitialization ??= initSDK({ tfheParams: tfheWasmUrl, kmsParams: kmsWasmUrl });
  return sdkInitialization;
}

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

export async function fetchPortfolioBalances(address: string) {
  await useConfiguredNetwork();
  const ethereum = getEthereum();
  const provider = new BrowserProvider(ethereum);
  const nativeBalance = formatEther(await provider.getBalance(address));
  const tokenBalances = await Promise.all(publicTokens.map(async (token) => {
    try {
      const contract = new Contract(token.address, erc20BalanceAbi, provider);
      const [balance, decimals] = await Promise.all([contract.balanceOf(address), contract.decimals()]);
      return { token, balance: formatUnits(balance, decimals), error: null };
    } catch {
      return { token, balance: '0', error: `Could not read ${token.symbol}.` };
    }
  }));

  let confidentialBalances: Awaited<ReturnType<typeof fetchConfidentialBalances>> = [];
  let confidentialError: string | null = null;
  try {
    confidentialBalances = await fetchConfidentialBalances(address, provider);
  } catch (error) {
    confidentialError = error instanceof Error ? error.message : 'Could not decrypt confidential balances.';
  }

  return { nativeBalance, tokenBalances, confidentialBalances, confidentialError };
}

async function fetchConfidentialBalances(address: string, provider: BrowserProvider) {
  if (deployedTokens.length === 0) return [];
  if (config.chainId !== TESTNET_CHAIN_ID) {
    throw new Error('Confidential balances require the Sepolia Zama relayer. Switch the app to Sepolia to decrypt them.');
  }

  const contracts = deployedTokens.map((token) => new Contract(token.address, confidentialBalanceAbi, provider));
  const entries = await Promise.all(contracts.map(async (contract, index) => {
    const [handle, decimals] = await Promise.all([
      contract.confidentialBalanceOf(address) as Promise<string>,
      contract.decimals() as Promise<bigint>,
    ]);
    return { token: deployedTokens[index], handle, decimals: Number(decimals) };
  }));
  const zeroHandle = /^0x0{64}$/i;
  const decryptableEntries = entries.filter((entry) => !zeroHandle.test(entry.handle));
  const zeroBalances = entries
    .filter((entry) => zeroHandle.test(entry.handle))
    .map(({ token, decimals }) => ({ token, balance: formatUnits(0n, decimals) }));
  if (decryptableEntries.length === 0) return zeroBalances;
  const startTimestamp = Math.floor(Date.now() / 1000);
  await initializeFheSdk();
  const fhevm = await createInstance({ ...SepoliaConfigV2, network: getEthereum() });
  const keypair = fhevm.generateKeypair();
  const contractAddresses = decryptableEntries.map((entry) => entry.token.address);
  const eip712 = fhevm.createEIP712(keypair.publicKey, contractAddresses, startTimestamp, 1);
  const signer = await provider.getSigner(address);
  const { EIP712Domain: _domainType, ...signingTypes } = eip712.types;
  const signature = await signer.signTypedData(
    eip712.domain,
    signingTypes as unknown as Record<string, Array<{ name: string; type: string }>>,
    eip712.message,
  );
  const clearValues = await fhevm.userDecrypt(
    decryptableEntries.map(({ handle, token }) => ({ handle, contractAddress: token.address })),
    keypair.privateKey,
    keypair.publicKey,
    signature,
    contractAddresses,
    address,
    startTimestamp,
    1,
  );

  const decryptedBalances = decryptableEntries.map(({ token, handle, decimals }) => ({
    token,
    balance: formatUnits(clearValues[handle as `0x${string}`] as bigint, decimals),
  }));
  return [...decryptedBalances, ...zeroBalances];
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
  if (config.chainId !== TESTNET_CHAIN_ID) {
    throw new Error('Private swaps require a Sepolia deployment with the Zama relayer.');
  }
  await useConfiguredNetwork();
  await initializeFheSdk();
  const fhevm = await createInstance({ ...SepoliaConfigV2, network: getEthereum() });
  const pairAddress = deployedPairs[pairKey(sellTokenAddress, buyTokenAddress)] || config.pairAddress;
  const pair = new Contract(pairAddress, pairAbi, signer);
  const pairToken0 = await pair.token0();
  const inputToken = new Contract(sellTokenAddress, erc7984Abi, signer);
  const direction = pairToken0.toLowerCase() === sellTokenAddress.toLowerCase();
  await (await inputToken.setOperator(pairAddress, Math.floor(Date.now() / 1000) + 3600)).wait();
  const encryptedInput = await fhevm.createEncryptedInput(pairAddress, address).add64(amountIn).encrypt();
  const encryptedOutput = await fhevm.createEncryptedInput(pairAddress, address).add64(amountOutTarget).encrypt();
  return pair.swapExactInput(direction, encryptedInput.handles[0], encryptedOutput.handles[0], encryptedInput.inputProof, encryptedOutput.inputProof);
}

export async function submitConfidentialRedemption(
  signer: JsonRpcSigner,
  address: string,
  tokenAddress: string,
  amount: bigint,
) {
  if (!config.vaultAddress) throw new Error('Configure the relayer vault before redeeming.');
  await useConfiguredNetwork();
  await initializeFheSdk();
  const fhevm = await createInstance({ ...SepoliaConfigV2, network: getEthereum() });
  const token = new Contract(tokenAddress, erc7984Abi, signer);
  const underlyingToken = await token.underlyingToken() as string;
  const encrypted = await fhevm.createEncryptedInput(tokenAddress, address).add64(amount).encrypt();
  const requestId = await token.relayerBurnRequest.staticCall(
    encrypted.handles[0],
    encrypted.inputProof,
    amount,
  ) as bigint;
  await (await token.relayerBurnRequest(encrypted.handles[0], encrypted.inputProof, amount)).wait();
  return { requestId, underlyingToken };
}

export async function fetchWithdrawalRequest(requestId: bigint) {
  if (!config.vaultAddress) throw new Error('Configure the relayer vault before checking withdrawals.');
  await useConfiguredNetwork();
  const provider = new BrowserProvider(getEthereum());
  const vault = new Contract(config.vaultAddress, vaultWithdrawalAbi, provider);
  const request = await vault.getWithdrawalRequest(requestId);
  return {
    user: request.user as string,
    token: request.token as string,
    amount: request.amount as bigint,
    requestedAt: request.requestedAt as bigint,
    fulfilled: request.fulfilled as boolean,
    escaped: request.escaped as boolean,
  };
}

export async function claimEscapedWithdrawal(signer: JsonRpcSigner, requestId: bigint) {
  if (!config.vaultAddress) throw new Error('Configure the relayer vault before claiming withdrawals.');
  await useConfiguredNetwork();
  const vault = new Contract(config.vaultAddress, vaultWithdrawalAbi, signer);
  return (await vault.claimEscapedWithdrawal(requestId)).wait();
}