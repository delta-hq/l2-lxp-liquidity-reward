import {
  Abi,
  Address,
  createPublicClient,
  extractChain,
  http,
  MulticallParameters,
  PublicClient,
} from "viem";
import { linea } from "viem/chains";
import { CHAINS, RPC_URLS } from "./config";
import lensABI from "./abis/PairAPIABI.json";
import veLYNXAbi from "./abis/veLYNX.json";

export const LENS_ADDRESS = "0x6c84329CC8c37376eb32db50a17F3bFc917c3665"; // PairAPI
export const VE_LYNX_ADDRESS = "0x8d95f56b0bac46e8ac1d3a3f12fb1e5bc39b4c0c"; // veLYNX

export interface LensResponse {
  pair_address: string;
  symbol: string;
  name: string;
  decimals: bigint;
  stable: boolean;
  total_supply: bigint;
  token0: string;
  token0_symbol: string;
  token0_decimals: bigint;
  reserve0: bigint;
  claimable0: string;
  token1: string;
  token1_symbol: string;
  token1_decimals: bigint;
  reserve1: bigint;
  claimable1: bigint;
  gauge: string;
  gauge_total_supply: bigint;
  fee: string;
  bribe: string;
  emissions: bigint;
  emissions_token: string;
  emissions_token_decimals: bigint;
  account_lp_balance: bigint;
  account_token0_balance: bigint;
  account_token1_balance: bigint;
  account_gauge_balance: bigint;
  account_locked_gauge_balance: bigint;
  account_lock_end: bigint;
  account_gauge_earned: bigint;
  userAddress: string;
}

export interface LensResponseWithBlock {
  result: LensResponse;
}

export interface VoteRequest {
  userAddress: string;
  amount: bigint;
}

export interface VoteResponse {
  result: VoteRequest;
}

export const fetchUserPools = async (
  blockNumber: bigint,
  userAddress: string,
  userPools: string[]
): Promise<LensResponseWithBlock[]> => {
  const publicClient = createPublicClient({
    chain: extractChain({ chains: [linea], id: CHAINS.L2_CHAIN_ID }),
    transport: http(RPC_URLS[CHAINS.L2_CHAIN_ID]),
  });

  const calls = userPools.map((pool: string) => {
    return {
      address: LENS_ADDRESS,
      name: "getPair",
      params: [pool, userAddress],
    };
  });

  const res = (await multicall(
    publicClient,
    lensABI as Abi,
    calls,
    blockNumber
  )) as any;
  return res.map((r: any) => {
    return { result: { ...r.result, userAddress } };
  }) as LensResponseWithBlock[];
};

export const fetchUserVotes = async (
  blockNumber: bigint,
  userAddress: string
): Promise<VoteResponse[]> => {
  const publicClient = createPublicClient({
    chain: extractChain({ chains: [linea], id: CHAINS.L2_CHAIN_ID }),
    transport: http(RPC_URLS[CHAINS.L2_CHAIN_ID]),
  });

  const userBalanceCall = await multicall(
    publicClient,
    veLYNXAbi as Abi,
    [
      {
        address: VE_LYNX_ADDRESS,
        name: "balanceOf",
        params: [userAddress],
      },
    ],
    blockNumber
  );

  const userBalance = userBalanceCall[0].result as number;

  if (userBalance === 0) return [];

  const calls = [];
  for (let i = 0; i < userBalance; i++) {
    calls.push({
      address: VE_LYNX_ADDRESS,
      name: "tokenOfOwnerByIndex",
      params: [userAddress, i],
    });
  }

  const userTokensCalls = await multicall(
    publicClient,
    veLYNXAbi as Abi,
    calls,
    blockNumber
  );

  const detailsCall = userTokensCalls.map((call) => {
    return {
      address: VE_LYNX_ADDRESS,
      name: "lockDetails",
      params: [call.result],
    };
  });

  const res = (await multicall(
    publicClient,
    veLYNXAbi as Abi,
    detailsCall,
    blockNumber
  )) as any;
  return res.map((r: any) => {
    return { result: { ...r.result, userAddress } };
  }) as VoteResponse[];
};

function multicall(
  publicClient: PublicClient,
  abi: Abi,
  calls: any[],
  blockNumber: bigint
) {
  const call: MulticallParameters = {
    contracts: calls.map((call) => {
      return {
        address: call.address as Address,
        abi,
        functionName: call.name,
        args: call.params,
      };
    }),
    blockNumber,
  };

  return publicClient.multicall(call);
}
