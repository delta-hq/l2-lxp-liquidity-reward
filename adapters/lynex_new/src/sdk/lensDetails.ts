import {
  Abi,
  Address,
  createPublicClient,
  extractChain,
  http,
  MulticallParameters,
  PublicClient,
} from "viem";
import { client, PROBLEM_POOLS } from "./config";
import lensABI from "./abis/PairAPIABI.json";
import veLYNXAbi from "./abis/veLYNX.json";
import { Gauge } from "./subgraphDetails";
import { chunk, flatten, groupBy } from 'lodash';

export const LENS_ADDRESS = "0x6c84329CC8c37376eb32db50a17F3bFc917c3665"; // PairAPI
export const VE_LYNX_ADDRESS = "0x8d95f56b0bac46e8ac1d3a3f12fb1e5bc39b4c0c"; // veLYNX
export const LYNX_ADDRESS = "0x1a51b19ce03dbe0cb44c1528e34a7edd7771e9af"; // LYNX

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

export interface PoolsLensResponseWithBlock {
  [key: string]: LensResponse[];
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
  const publicClient = client;
  const validPools = userPools.filter((pool) => PROBLEM_POOLS[pool] === undefined || PROBLEM_POOLS[pool] > blockNumber);

  const calls = validPools.map((pool: string) => {
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
  const delay = (ms: number | undefined) => new Promise(resolve => setTimeout(resolve, ms))
  await delay(3000)
  return res.map((r: any) => {
    if (r.status !== 'success') {
      throw new Error("RPC call error. Status: " + r.status);
  }
    return { result: { ...r.result, userAddress } };
  }) as LensResponseWithBlock[];
};

export const fetchPools = async (
  blockNumber: bigint,
  allGauges: Gauge[],
): Promise<PoolsLensResponseWithBlock> => {
  const publicClient = client;
  const validPools = allGauges.filter(
    (gauge) =>
      PROBLEM_POOLS[gauge.pool] === undefined ||
      PROBLEM_POOLS[gauge.pool] > blockNumber,
  );

  const calls = validPools.map((gauge: Gauge) => {
    return {
      address: LENS_ADDRESS,
      name: 'getPair',
      params: [gauge.pool, '0x0000000000000000000000000000000000000000'],
    };
  });

  const res = await multicall(
    publicClient,
    lensABI as Abi,
    calls,
    blockNumber,
  );

  const mapped = res.map((r: any) => {
    return { ...r.result, pair_address: r.result.pair_address.toLowerCase() };
  });

  const grouped = groupBy(mapped, 'pair_address');

  return grouped;
};

export const fetchUserVotes = async (
  blockNumber: bigint,
  userAddress: string
): Promise<VoteResponse[]> => {
  const publicClient = client;

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

export const fetchVeLynx = async (
  blockNumber: bigint,
): Promise<VoteResponse[]> => {
  const publicClient = client;

  const totalNftIdsCall =  await multicall(
    publicClient,
    veLYNXAbi as Abi,
    [
      {
        address: VE_LYNX_ADDRESS,
        name: "totalNftsMinted",
      },
    ],
    blockNumber
  );

  const totalNftIds = parseInt(totalNftIdsCall[0].result as string)

  const calls = [];
  for (let i = 2; i <= totalNftIds; i++) {
    calls.push({
      address: VE_LYNX_ADDRESS,
      name: "ownerOf",
      params: [i],
    });
  }

  const addressCalls = await multicallChunk(
    publicClient,
    veLYNXAbi as Abi,
    calls,
    blockNumber,
    3000
  );

  const detailsCall = addressCalls.map((call, i) => {
    return {
      address: VE_LYNX_ADDRESS,
      name: "lockDetails",
      params: [i + 2],
    };
  });

  const res = (await multicallChunk(
    publicClient,
    veLYNXAbi as Abi,
    detailsCall,
    blockNumber,
    3000
  )) as any;
  const result = res.map((r: any, i: number) => {
    return { result: { ...r.result, userAddress: addressCalls[i].result } };
  }) as VoteResponse[];
  return result
};

async function multicallChunk(
  publicClient: PublicClient,
  abi: Abi,
  calls: any[],
  blockNumber: bigint,
  size = 100
) {
  const chunked = chunk(calls, size);
  const callsPromises = [];
  for (let i = 0; i < chunked.length; i++) {
    callsPromises.push(
      multicall(publicClient, abi, chunked[i], blockNumber),
    );
  }
  const res = await Promise.all(callsPromises);
  return flatten(res);
}

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
