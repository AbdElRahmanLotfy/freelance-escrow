import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Sepolia USDC address (official Circle deployment)
const SEPOLIA_USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
// For testing, use 0x0. For production, use a real yield strategy like Aave
const MOCK_YIELD = "0x0000000000000000000000000000000000000000";

const EscrowModule = buildModule("EscrowModule", (m) => {
  const usdcAddress = m.getParameter("usdcAddress", SEPOLIA_USDC);
  const yieldStrategy = m.getParameter("yieldStrategy", MOCK_YIELD);

  const escrow = m.contract("EscrowWithYield", [usdcAddress, yieldStrategy]);

  return { escrow };
});

export default EscrowModule;
