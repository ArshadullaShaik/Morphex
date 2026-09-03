const { ethers } = require("ethers");

async function main() {
  const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
  const user = "0x00ea78522B3192f9b766795EcBF1030970aBBeb9";
  const nonce = await provider.getTransactionCount(user);
  console.log(`Current Nonce of ${user}: ${nonce}`);

  const currentBlock = await provider.getBlockNumber();
  console.log(`Current Block: ${currentBlock}`);

  // Query transfer logs for user on cUSDT and cUSDC
  const cUSDT = "0x60f00ea035D8350BF6E3d98a148dCeBeCDa9d0B0";
  const cUSDC = "0x242064EA104a0cC49426dAcF0689E95774ed249B";
  const pair = "0x72c84eCfba7DB1DC1D7fA1Bf12D4343f455BC939";

  const pairContract = new ethers.Contract(
    pair,
    ["event Swap(address indexed trader, bool indexed zeroForOne)"],
    provider
  );

  const swapEvents = await pairContract.queryFilter(pairContract.filters.Swap(), currentBlock - 30);
  console.log(`Swap events in last 30 blocks (${currentBlock - 30} to ${currentBlock}):`);
  for (const ev of swapEvents) {
    console.log(`  - Block ${ev.blockNumber}: trader=${ev.args.trader}, tx=${ev.transactionHash}`);
  }
}

main().catch(console.error);
