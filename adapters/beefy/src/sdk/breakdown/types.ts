import { Hex } from "viem";
import { BeefyVault } from "../vault/getBeefyVaultConfig";

export type BeefyVaultBreakdown = {
  vault: BeefyVault;
  blockNumber: bigint;
  vaultTotalSupply: bigint;
  balances: {
    tokenAddress: Hex;
    vaultBalance: bigint;
  }[];
};
