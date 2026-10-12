import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Base Sepolia USDC (Circle)
const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

// Aave V3 Pool — Base Sepolia
const AAVE_POOL_BASE_SEPOLIA = "0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b";

// Aave V3 aUSDC — Base Sepolia (verified from getReserveData slot 8)
const A_USDC_BASE_SEPOLIA = "0xf53B60F4006cab2b3C4688ce41fD5362427A2A66";

const EscrowBaseModule = buildModule("EscrowBaseModule", (m) => {
  const usdcAddress = m.getParameter("usdcAddress", USDC_BASE_SEPOLIA);
  const aavePool = m.getParameter("aavePool", AAVE_POOL_BASE_SEPOLIA);
  const aToken = m.getParameter("aToken", A_USDC_BASE_SEPOLIA);

  const escrow = m.contract("EscrowWithYield", [usdcAddress, aavePool, aToken]);

  return { escrow };
});

export default EscrowBaseModule;
