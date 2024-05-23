import { getContract } from "viem";
import { BeefyVault } from "../../vault/getBeefyVaultConfig";
import { BeefyViemClient } from "../../viemClient";
import { BeefyVaultBreakdown } from "../types";
import { BeefyVaultV7Abi } from "../../../abi/BeefyVaultV7Abi";
import { SolidlyPoolAbi } from "../../../abi/SolidlyPoolAbi";

export const getSolidlyVaultBreakdown = async (
  client: BeefyViemClient,
  blockNumber: bigint,
  vault: BeefyVault
): Promise<BeefyVaultBreakdown> => {
  const vaultContract = getContract({
    client,
    address: vault.vault_address,
    abi: BeefyVaultV7Abi,
  });
  const poolContract = getContract({
    client,
    address: vault.undelying_lp_address,
    abi: SolidlyPoolAbi,
  });

  const [balance, vaultTotalSupply, totalSupply, poolMetadata] =
    await Promise.all([
      vaultContract.read.balance({ blockNumber }),
      vaultContract.read.totalSupply({ blockNumber }),
      poolContract.read.totalSupply({ blockNumber }),
      poolContract.read.metadata({ blockNumber }),
    ]);

  const t0 = poolMetadata[5];
  const t1 = poolMetadata[6];
  const r0 = poolMetadata[2];
  const r1 = poolMetadata[3];

  return {
    vault,
    blockNumber,
    vaultTotalSupply,
    balances: [
      {
        tokenAddress: t0,
        vaultBalance: (r0 * balance) / totalSupply,
      },
      {
        tokenAddress: t1,
        vaultBalance: (r1 * balance) / totalSupply,
      },
    ],
  };
};
