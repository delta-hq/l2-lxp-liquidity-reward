import { Hex, getContract } from "viem";
import { BeefyVault } from "../../vault/getBeefyVaultConfig";
import { BeefyViemClient } from "../../viemClient";
import { BeefyVaultBreakdown } from "../types";
import { BeefyVaultV7Abi } from "../../../abi/BeefyVaultV7Abi";

export const getMendiVaultBreakdown = async (
  client: BeefyViemClient,
  blockNumber: bigint,
  vault: BeefyVault
): Promise<BeefyVaultBreakdown> => {
  const vaultContract = getContract({
    client,
    address: vault.vault_address,
    abi: BeefyVaultV7Abi,
  });

  const [balance, vaultTotalSupply] = await Promise.all([
    vaultContract.read.balance({ blockNumber }),
    vaultContract.read.totalSupply({ blockNumber }),
  ]);

  return {
    vault,
    blockNumber,
    vaultTotalSupply,
    balances: [
      {
        tokenAddress: vault.undelying_lp_address.toLocaleLowerCase() as Hex,
        vaultBalance: balance,
      },
    ],
  };
};
