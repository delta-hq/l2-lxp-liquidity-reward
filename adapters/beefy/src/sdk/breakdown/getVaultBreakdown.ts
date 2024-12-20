import { BeefyProtocolType, BeefyVault } from "../vault/getBeefyVaultConfig";
import { BeefyVaultBreakdown } from "./types";
import { BeefyViemClient, getViemClient } from "../viemClient";
import { getSolidlyVaultBreakdown } from "./protocol_type/solidly";
import { getGammaVaultBreakdown } from "./protocol_type/gamma";
import { getSingleTokenVaultBreakdown } from "./protocol_type/single_token";
import {
  getBeefyClmManagerBreakdown,
  getBeefyClmVaultBreakdown,
} from "./protocol_type/beefy_clm";

type BreakdownMethod = (
  client: BeefyViemClient,
  blockNumber: bigint,
  vault: BeefyVault
) => Promise<BeefyVaultBreakdown>;

const breakdownMethods: Record<BeefyProtocolType, BreakdownMethod> = {
  solidly: getSolidlyVaultBreakdown,
  single_token: getSingleTokenVaultBreakdown,
  gamma: getGammaVaultBreakdown,
  ichi: getGammaVaultBreakdown,
  beefy_clm: getBeefyClmManagerBreakdown,
  beefy_clm_vault: getBeefyClmVaultBreakdown,
};

export const getVaultBreakdowns = async (
  blockNumber: bigint,
  vaults: BeefyVault[]
): Promise<BeefyVaultBreakdown[]> => {
  // group by protocol type
  const vaultsPerProtocol: Record<BeefyProtocolType, BeefyVault[]> =
    vaults.reduce((acc, vault) => {
      if (!acc[vault.protocol_type]) {
        acc[vault.protocol_type] = [];
      }
      acc[vault.protocol_type].push(vault);
      return acc;
    }, {} as Record<BeefyProtocolType, BeefyVault[]>);

  return (
    await Promise.all(
      (Object.keys(vaultsPerProtocol) as BeefyProtocolType[]).map(
        async (protocolType) => {
          const client = getViemClient();
          const vaults = vaultsPerProtocol[protocolType];
          const getBreakdown = breakdownMethods[protocolType];
          return await Promise.all(
            vaults.map((vault) => getBreakdown(client, blockNumber, vault))
          );
        }
      )
    )
  ).flat();
};
