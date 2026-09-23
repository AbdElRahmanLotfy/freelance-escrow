import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { AaveV3BaseSepolia } from "@aave-dao/aave-address-book";

// USDC address for Base Sepolia
const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
// Aave Pool address is pulled dynamically from the package
const AAVE_POOL_BASE_SEPOLIA = AaveV3BaseSepolia.POOL;

const EscrowBaseModule = buildModule("EscrowBaseModule", (m) => {
  const usdcAddress = m.getParameter("usdcAddress", USDC_BASE_SEPOLIA);
  const aavePool = m.getParameter("aavePool", AAVE_POOL_BASE_SEPOLIA);

  const escrow = m.contract("EscrowWithYield", [usdcAddress, aavePool]);

  return { escrow };
});

export default EscrowBaseModule;
