import { Hex } from "viem";
import {
  BeefyProtocolType,
  BeefyVault,
  getBeefyVaultConfig,
} from "../vault/getBeefyVaultConfig";
import { BeefyVaultBreakdown } from "./types";
import { BeefyViemClient, clients } from "../viemClient";
import { flatten, sample } from "lodash";
import { getSolidlyVaultBreakdown } from "./protocol_type/solidly";
import { getGammaVaultBreakdown } from "./protocol_type/gamma";
import { getMendiVaultBreakdown } from "./protocol_type/mendi";

type BreakdownMethod = (
  client: BeefyViemClient,
  blockNumber: bigint,
  vault: BeefyVault
) => Promise<BeefyVaultBreakdown>;

const breakdownMethods: Record<BeefyProtocolType, BreakdownMethod> = {
  solidly: getSolidlyVaultBreakdown,
  mendi: getMendiVaultBreakdown,
  gamma: getGammaVaultBreakdown,
  ichi: getGammaVaultBreakdown,
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

  return flatten(
    await Promise.all(
      (Object.keys(vaultsPerProtocol) as BeefyProtocolType[]).map(
        async (protocolType) => {
          const client = sample(clients) as BeefyViemClient;
          const vaults = vaultsPerProtocol[protocolType];
          const getBreakdown = breakdownMethods[protocolType];
          return await Promise.all(
            vaults.map((vault) => getBreakdown(client, blockNumber, vault))
          );
        }
      )
    )
  );
};
