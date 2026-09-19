#!/usr/bin/env bash
# ==============================================================================
# Morphex — Start Relayer Daemon
# ==============================================================================
set -e

# Change to project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo "=================================================="
echo "  Morphex Relayer Bot Launcher"
echo "=================================================="

# Check for .env file or PRIVATE_KEY env variable
if [ -z "$PRIVATE_KEY" ] && [ ! -f .env ]; then
  echo "⚠️  WARNING: No PRIVATE_KEY environment variable and no .env file found!"
  echo "   The relayer needs the private key for wallet 0x00ea78522B3192f9b766795EcBF1030970aBBeb9"
  echo "   which holds the RELAYER_ROLE to encrypt and mint tokens."
  echo ""
  echo "Usage:"
  echo "  PRIVATE_KEY=\"0x...\" ./scripts/start-relayer.sh"
  echo "  or add PRIVATE_KEY=\"0x...\" to .env and run:"
  echo "  ./scripts/start-relayer.sh"
  echo "=================================================="
fi

echo "Starting Relayer Daemon on Sepolia network..."
npx hardhat run scripts/relayer-daemon.ts --network sepolia
