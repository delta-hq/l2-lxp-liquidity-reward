import { memoize } from "lodash";
import { Hex } from "viem";
import { BEEFY_GOV_API, BEEFY_VAULT_API } from "../../config";

export type BeefyVault = {
  id: string;
  vault_address: Hex;
  undelying_lp_address: Hex;
  strategy_address: Hex;
  chain: string;
  protocol_type: BeefyProtocolType;
  reward_pools: BeefyRewardPool[];
};

export type BeefyRewardPool = {
  id: string;
  clm_address: Hex;
  reward_pool_address: Hex;
};

export type BeefyProtocolType =
  | "gamma"
  | "ichi"
  | "mendi"
  | "solidly"
  | "beefy_clm";

type ApiPlatformId = "gamma" | "ichi" | "lynex" | "mendi" | "nile" | "beefy"; // and more but we don't use those on linea

type ApiVault = {
  id: string;
  status: "active" | "eol";
  earnedTokenAddress: Hex;
  chain: string;
  platformId: ApiPlatformId;
  tokenAddress: Hex;
  strategy: Hex;
};

type ApiGovVault = {
  id: string;
  status: "active" | "eol";
  version: number;
  chain: string;
  tokenAddress: Hex; // clm address
  earnContractAddress: Hex; // reward pool address
};

const protocol_map: Record<ApiPlatformId, BeefyProtocolType> = {
  gamma: "gamma",
  ichi: "ichi",
  lynex: "solidly",
  mendi: "mendi",
  nile: "solidly",
  beefy: "beefy_clm",
};

export const getBeefyVaultConfig = memoize(
  async (chain: string): Promise<BeefyVault[]> => {
    const [vaultsData, rewardPoolData] = await Promise.all([
      fetch(BEEFY_VAULT_API).then((res) => res.json()),
      fetch(BEEFY_GOV_API).then((res) => res.json()),
    ]);

    const rewardPoolsPerClm = rewardPoolData
      .filter((pool: ApiGovVault) => pool.status === "active")
      .filter((pool: ApiGovVault) => pool.version === 2)
      .filter((pool: ApiGovVault) => pool.chain === chain)
      .reduce((acc: Record<string, BeefyRewardPool[]>, pool: ApiGovVault) => {
        const clm_address = pool.tokenAddress.toLocaleLowerCase() as Hex;
        const reward_pool_address =
          pool.earnContractAddress.toLocaleLowerCase() as Hex;
        if (!acc[clm_address]) {
          acc[clm_address] = [];
        }
        acc[clm_address].push({
          id: pool.id,
          clm_address,
          reward_pool_address,
        });
        return acc;
      }, {} as Record<string, BeefyRewardPool[]>);

    const vaults = vaultsData
      .filter((vault: ApiVault) => vault.chain === chain)
      .filter((vault: ApiVault) => vault.status === "active")
      .map((vault: ApiVault): BeefyVault => {
        let protocol_type = protocol_map[vault.platformId];
        if (!protocol_type) {
          throw new Error(`Unknown platformId ${vault.platformId}`);
        }

        let reward_pools =
          rewardPoolsPerClm[vault.earnedTokenAddress.toLocaleLowerCase()] ?? [];

        return {
          id: vault.id,
          vault_address: vault.earnedTokenAddress.toLocaleLowerCase() as Hex,
          chain: vault.chain,
          protocol_type,
          strategy_address: vault.strategy.toLocaleLowerCase() as Hex,
          undelying_lp_address: vault.tokenAddress.toLocaleLowerCase() as Hex,
          reward_pools,
        };
      });

    return vaults;
  }
);
