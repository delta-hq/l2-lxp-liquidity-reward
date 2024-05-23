import { memoize } from "lodash";
import { Hex } from "viem";

const BEEFY_VAULT_API = "https://api.beefy.finance/vaults";

export type BeefyVault = {
  id: string;
  vault_address: Hex;
  undelying_lp_address: Hex;
  chain: string;
  protocol_type: BeefyProtocolType;
};

export type BeefyProtocolType = "gamma" | "ichi" | "mendi" | "solidly";

type ApiPlatformId = "gamma" | "ichi" | "lynex" | "mendi" | "nile"; // and more but we don't use those on linea

type ApiVault = {
  id: string;
  status: "active" | "eol";
  earnedTokenAddress: Hex;
  chain: string;
  platformId: ApiPlatformId;
  tokenAddress: Hex;
};

const protocol_map: Record<ApiPlatformId, BeefyProtocolType> = {
  gamma: "gamma",
  ichi: "ichi",
  lynex: "solidly",
  mendi: "mendi",
  nile: "solidly",
};

export const getBeefyVaultConfig = memoize(
  async (chain: string): Promise<BeefyVault[]> => {
    const response = await fetch(BEEFY_VAULT_API);
    const data = await response.json();

    const vaults = data
      .filter((vault: ApiVault) => vault.chain === chain)
      .filter((vault: ApiVault) => vault.status === "active")
      .map((vault: ApiVault): BeefyVault => {
        let protocol_type = protocol_map[vault.platformId];
        if (!protocol_type) {
          throw new Error(`Unknown platformId ${vault.platformId}`);
        }
        return {
          id: vault.id,
          vault_address: vault.earnedTokenAddress.toLocaleLowerCase() as Hex,
          chain: vault.chain,
          protocol_type,
          undelying_lp_address: vault.tokenAddress.toLocaleLowerCase() as Hex,
        };
      });

    return vaults;
  }
);
