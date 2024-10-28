import { groupBy, memoize } from "lodash";
import { Hex } from "viem";
import {
  BEEFY_BOOST_API,
  BEEFY_COW_VAULT_API,
  BEEFY_GOV_API,
  BEEFY_MOO_VAULT_API,
} from "../../config";

export type BeefyVault = {
  id: string;
  vault_address: Hex;
  undelying_lp_address: Hex;
  strategy_address: Hex;
  vault_token_symbol: string;
  chain: string;
  reward_pools: BeefyRewardPool[];
  boosts: BeefyBoost[];
} & (
  | {
      protocol_type: "beefy_clm_vault";
      beefy_clm_manager: BeefyVault;
    }
  | {
      protocol_type: Exclude<BeefyProtocolType, "beefy_clm_vault">;
    }
);

export type BeefyRewardPool = {
  id: string;
  clm_address: Hex;
  reward_pool_address: Hex;
};

export type BeefyBoost = {
  id: string;
  boost_address: Hex;
  underlying_address: Hex;
};

export type BeefyProtocolType =
  | "gamma"
  | "ichi"
  | "single_token"
  | "solidly"
  | "beefy_clm"
  | "beefy_clm_vault";

type ApiPlatformId =
  | "gamma"
  | "ichi"
  | "lynex"
  | "mendi"
  | "nile"
  | "stargate"
  | "velodrome"
  | "beefy"; // and more but we don't use those on linea

export type ApiStrategyTypeId =
  | "lp"
  | "multi-lp"
  | "multi-lp-locked"
  | "cowcentrated";

export type ApiVault = {
  id: string;
  status: "active" | "eol";
  earnedTokenAddress: string;
  depositTokenAddresses?: string[];
  chain: string;
  platformId: ApiPlatformId;
  token: string;
  tokenAddress: string;
  earnedToken: string;
  isGovVault?: boolean;
  strategyTypeId?: ApiStrategyTypeId;
  bridged?: object;
  assets?: string[];
  strategy: Hex;
};

export type ApiClmManager = {
  id: string;
  status: "active" | "eol";
  version: number;
  platformId: ApiPlatformId;
  strategyTypeId?: ApiStrategyTypeId;
  earnedToken: string;
  strategy: string;
  chain: string;
  type: "cowcentrated" | "others";
  tokenAddress: string; // underlying pool address
  depositTokenAddresses: string[]; // token0 and token1
  earnContractAddress: string; // reward pool address
  earnedTokenAddress: string; // clm manager address
};

export type ApiClmRewardPool = {
  id: string;
  status: "active" | "eol";
  version: number;
  platformId: ApiPlatformId;
  strategyTypeId?: ApiStrategyTypeId;
  chain: string;
  tokenAddress: string; // clm address (want)
  earnContractAddress: string; // reward pool address
  earnedTokenAddresses: string[]; // reward tokens
};

export type ApiGovVault = {
  id: string;
  status: "active" | "eol";
  version: number;
  chain: string;
  tokenAddress: string; // clm address
  earnContractAddress: string; // reward pool address
  earnedTokenAddresses: string[];
};

export type ApiBoost = {
  id: string;
  poolId: string;

  version: number;
  chain: string;
  status: "active" | "eol";

  tokenAddress: string; // underlying
  earnedTokenAddress: string; // reward token address
  earnContractAddress: string; // reward pool address
};

const protocol_map: Record<ApiPlatformId, BeefyProtocolType> = {
  gamma: "gamma",
  ichi: "ichi",
  lynex: "solidly",
  mendi: "single_token",
  nile: "solidly",
  velodrome: "solidly",
  beefy: "beefy_clm",
  stargate: "single_token",
};

export const getBeefyVaultConfig = memoize(
  async (chain: string): Promise<BeefyVault[]> => {
    const [
      cowVaultsData,
      mooVaultsData,
      clmRewardPoolData,
      [boostData, vaultRewardPoolData],
    ] = await Promise.all([
      fetch(BEEFY_COW_VAULT_API + `/${chain}`)
        .then((res) => res.json())
        .then((res) =>
          (res as ApiClmManager[]).filter((vault) => vault.chain === chain)
        ),
      fetch(BEEFY_MOO_VAULT_API + `/${chain}`)
        .then((res) => res.json())
        .then((res) =>
          (res as ApiVault[])
            .filter((vault) => vault.chain === chain)
            .filter((vault) => vault.isGovVault !== true)
        ),
      fetch(BEEFY_GOV_API + `/${chain}`)
        .then((res) => res.json())
        .then((res) =>
          (res as ApiClmRewardPool[])
            .filter((g) => g.chain === chain)
            .filter((g) => g.version === 2)
        ),
      fetch(BEEFY_BOOST_API + `/${chain}`)
        .then((res) => res.json())
        .then((res) => [
          (res as ApiBoost[])
            .filter((g) => g.chain === chain)
            .filter((g) => g.version !== 2),
          (res as ApiBoost[])
            .filter((g) => g.chain === chain)
            .filter((g) => g.version === 2),
        ]),
    ]);

    const clmManagerAddresses = new Set(
      cowVaultsData.map((v) => v.earnedTokenAddress.toLocaleLowerCase())
    );
    const boostPerUnderlyingAddress = groupBy(boostData, (b) =>
      b.tokenAddress.toLocaleLowerCase()
    );
    const vaultRewardPoolDataPerVaultAddress = groupBy(
      vaultRewardPoolData,
      (v) => v.tokenAddress.toLocaleLowerCase()
    );
    const clmRewardPoolDataPerClmAddress = groupBy(clmRewardPoolData, (c) =>
      c.tokenAddress.toLocaleLowerCase()
    );

    const clmVaultConfigs = cowVaultsData.map((vault): BeefyVault => {
      const undelying_lp_address =
        vault.tokenAddress.toLocaleLowerCase() as Hex;
      const vault_address = vault.earnedTokenAddress.toLocaleLowerCase() as Hex;

      let protocol_type =
        vault.type === "cowcentrated"
          ? "beefy_clm"
          : protocol_map[vault.platformId];
      if (!protocol_type) {
        throw new Error(`Unknown platformId ${vault.platformId}`);
      }
      if (protocol_type === "beefy_clm_vault") {
        throw new Error("Invalid protocol");
      }
      const reward_pools = clmRewardPoolDataPerClmAddress[vault_address] ?? [];

      const boosts = boostPerUnderlyingAddress[vault_address] ?? [];

      return {
        id: vault.id,
        vault_address,
        chain: vault.chain,
        vault_token_symbol: vault.earnedToken,
        protocol_type,
        strategy_address: vault.strategy.toLocaleLowerCase() as Hex,
        undelying_lp_address,
        reward_pools: reward_pools.map((pool) => ({
          id: pool.id,
          clm_address: pool.tokenAddress.toLocaleLowerCase() as Hex,
          reward_pool_address:
            pool.earnContractAddress.toLocaleLowerCase() as Hex,
        })),
        boosts: boosts.map((boost) => ({
          id: boost.id,
          boost_address: boost.earnedTokenAddress.toLocaleLowerCase() as Hex,
          underlying_address: boost.tokenAddress.toLocaleLowerCase() as Hex,
        })),
      };
    });

    const mooVaultCofigs = mooVaultsData.map((vault): BeefyVault => {
      const undelying_lp_address =
        vault.tokenAddress.toLocaleLowerCase() as Hex;
      const vault_address = vault.earnedTokenAddress.toLocaleLowerCase() as Hex;

      let protocol_type = clmManagerAddresses.has(undelying_lp_address)
        ? "beefy_clm_vault"
        : protocol_map[vault.platformId];
      if (!protocol_type) {
        throw new Error(`Unknown platformId ${vault.platformId}`);
      }

      let additionalConfig =
        protocol_type === "beefy_clm_vault"
          ? {
              protocol_type,
              beefy_clm_manager: clmVaultConfigs.find(
                (v) => v.vault_address === undelying_lp_address
              ) as BeefyVault,
            }
          : { protocol_type };
      const reward_pools =
        vaultRewardPoolDataPerVaultAddress[vault_address] ?? [];
      const boosts = boostPerUnderlyingAddress[vault_address] ?? [];
      return {
        id: vault.id,
        vault_address,
        chain: vault.chain,
        vault_token_symbol: vault.earnedToken,
        ...additionalConfig,
        strategy_address: vault.strategy.toLocaleLowerCase() as Hex,
        undelying_lp_address,
        reward_pools: reward_pools.map((pool) => ({
          id: pool.id,
          clm_address: pool.tokenAddress.toLocaleLowerCase() as Hex,
          reward_pool_address:
            pool.earnContractAddress.toLocaleLowerCase() as Hex,
        })),
        boosts: boosts.map((boost) => ({
          id: boost.id,
          boost_address: boost.earnedTokenAddress.toLocaleLowerCase() as Hex,
          underlying_address: boost.tokenAddress.toLocaleLowerCase() as Hex,
        })),
      };
    });

    return clmVaultConfigs.concat(mooVaultCofigs);
  }
);
