import {
  Abi,
  Address,
  createPublicClient,
  extractChain,
  http,
  PublicClient,
} from "viem";
import { linea } from "viem/chains";
import { CHAINS, RPC_URLS } from "./config";
import lensABI from "./abis/LensABI.json";
import BigNumber from "bignumber.js";

export const getGaugesAtBlock = async (blockNumber: number) => {
  const publicClient = createPublicClient({
    chain: extractChain({ chains: [linea], id: CHAINS.L2_CHAIN_ID }),
    transport: http(RPC_URLS[CHAINS.L2_CHAIN_ID]),
  });

  const gauges = await fetchPools(publicClient, BigInt(blockNumber));
  return Object.fromEntries(
    gauges.map((g) => [
      g.gauge.toLowerCase(),
      g.underlyingTokens.map((t, idx) => ({
        address: "0x" + t.slice(26, 66).toLowerCase(),
        amountPerLp: BigNumber(g.stakedUnderlying[idx].toString()).div(
          g.stakedAmounts[0].toString()
        ),
      })),
    ])
  );
};

export const LENS_ADDRESS = "0xaA18cDb16a4DD88a59f4c2f45b5c91d009549e06";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const VE_VC_ADDRESS = "0xAeC06345b26451bdA999d83b361BEaaD6eA93F87";
export const VC_ADDRESS = "0xcc22F6AA610D1b2a0e89EF228079cB3e1831b1D1";
export type PoolType = "cpmm" | "wombat" | "converter" | "veVC";

export interface PoolRawData {
  pool: string;
  poolType: PoolType;
  poolParams: string;

  lpTokens: string[];
  mintedLPTokens: BigInt[];

  listedTokens: string[];
  reserves: BigInt[];
}

export interface BribeRawData {
  tokens: string[];
  rates: BigInt[];
  userClaimable: BigInt[];
  userRates: BigInt[];
}

export interface GaugeRawData {
  gauge: string;
  poolData: PoolRawData;
  killed: boolean;
  totalVotes: BigInt;
  userVotes: BigInt;
  userClaimable: BigInt;
  userRate: BigInt;
  stakedValueInHubToken: BigInt;
  userStakedValueInHubToken: BigInt;
  averageInterestRatePerSecond: BigInt;
  emissionRate: BigInt;

  stakeableTokens: string[];
  stakedAmounts: BigInt[];
  userStakedAmounts: BigInt[];

  underlyingTokens: string[];
  stakedUnderlying: BigInt[];
  userUnderlying: BigInt[];

  bribes: BribeRawData[];
}

export const fetchPools = async (
  publicClient: PublicClient,
  blockNumber: bigint
): Promise<GaugeRawData[]> => {
  const [poolLength] = (
    await Promise.allSettled([
      publicClient.simulateContract({
        address: LENS_ADDRESS,
        abi: lensABI,
        functionName: "canonicalPoolLength",
        args: [],
        blockNumber,
      }),
    ])
  ).map((result) =>
    result.status === "fulfilled" ? Number(result.value.result) : 0
  );

  const concatPools = (
    await Promise.allSettled([
      getCanonicalPoolsWithPagination(publicClient, poolLength, blockNumber),
      publicClient
        .simulateContract({
          address: LENS_ADDRESS,
          abi: lensABI as Abi,
          functionName: "wombatGauges",
          args: [ZERO_ADDRESS],
          blockNumber,
        })
        .then((res) => res.result),
    ])
  ).flatMap(({ status, value, reason }: any) => {
    if (reason) {
      console.error(reason);
    }
    return status === "fulfilled" ? value : [];
  });
  return concatPools as GaugeRawData[];
};

const getCanonicalPoolsWithPagination = async (
  publicClient: PublicClient,
  poolLength: number,
  blockNumber: bigint
) => {
  const MAX_POOL_PER_PAGE = poolLength;
  const RETRY = Math.floor(Math.log2(MAX_POOL_PER_PAGE)) + 1;
  for (let i = 0; i < RETRY; i++) {
    try {
      const poolPerPage = Math.floor(MAX_POOL_PER_PAGE / 2 ** i);
      return (
        await Promise.all(
          new Array(Math.ceil(poolLength / poolPerPage))
            .fill(0)
            .map((elt, idx) =>
              publicClient
                .simulateContract({
                  address: LENS_ADDRESS,
                  abi: lensABI as Abi,
                  functionName: "canonicalPools",
                  args: [ZERO_ADDRESS, idx * poolPerPage, poolPerPage],
                  blockNumber,
                })
                .then((res) => res.result)
            )
        )
      ).flat();
    } catch (err) {
      console.error("getCanonicalPoolsWithPagination", i, err);
    }
  }
  return [];
};
