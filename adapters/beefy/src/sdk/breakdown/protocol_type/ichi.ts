import { Hex, getContract } from "viem";
import { BeefyVault } from "../../vault/getBeefyVaultConfig";
import { BeefyViemClient } from "../../viemClient";
import { BeefyVaultBreakdown } from "../types";
import { BeefyVaultV7Abi } from "../../../abi/BeefyVaultV7Abi";
import { IchiAlmAbi } from "../../../abi/IchiAlmAbi";

export const getGammaVaultBreakdown = async (
  client: BeefyViemClient,
  blockNumber: bigint,
  vault: BeefyVault
): Promise<BeefyVaultBreakdown> => {
  const vaultContract = getContract({
    client,
    address: vault.vault_address,
    abi: BeefyVaultV7Abi,
  });
  const almContract = getContract({
    client,
    address: vault.undelying_lp_address,
    abi: IchiAlmAbi,
  });

  const [
    balance,
    vaultTotalSupply,
    totalSupply,
    basePosition,
    limitPosition,
    token0,
    token1,
  ] = await Promise.all([
    vaultContract.read.balance({ blockNumber }),
    vaultContract.read.totalSupply({ blockNumber }),
    almContract.read.totalSupply({ blockNumber }),
    almContract.read.getBasePosition({ blockNumber }),
    almContract.read.getLimitPosition({ blockNumber }),
    almContract.read.token0({ blockNumber }),
    almContract.read.token1({ blockNumber }),
  ]);

  const position0 = basePosition[0] + limitPosition[0];
  const position1 = basePosition[1] + limitPosition[1];

  return {
    vault,
    blockNumber,
    vaultTotalSupply,
    isLiquidityEligible: true,
    balances: [
      {
        tokenAddress: token0.toLocaleLowerCase() as Hex,
        vaultBalance: (position0 * balance) / totalSupply,
      },
      {
        tokenAddress: token1.toLocaleLowerCase() as Hex,
        vaultBalance: (position1 * balance) / totalSupply,
      },
    ],
  };
};
