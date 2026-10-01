import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Base Sepolia USDC
const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
// Aave V3 Pool on Base Sepolia (VERIFIED working)
const AAVE_POOL_BASE_SEPOLIA = "0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b";

const EscrowBaseModule = buildModule("EscrowBaseModule", (m) => {
  const usdcAddress = m.getParameter("usdcAddress", USDC_BASE_SEPOLIA);
  const aavePool = m.getParameter("aavePool", AAVE_POOL_BASE_SEPOLIA);

  const escrow = m.contract("EscrowWithYield", [usdcAddress, aavePool]);

  return { escrow };
});

export default EscrowBaseModule;
