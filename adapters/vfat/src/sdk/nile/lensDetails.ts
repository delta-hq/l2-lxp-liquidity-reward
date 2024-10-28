import { Abi, Address, MulticallParameters, PublicClient } from "viem";
import { client } from "./config";
import veNILEAbi from "./abis/veNILE.json";

export const VE_NILE_ADDRESS = "0xaaaea1fb9f3de3f70e89f37b69ab11b47eb9ce6f";

export interface VoteRequest {
  userAddress: string;
  amount: bigint;
}

export interface VoteResponse {
  result: VoteRequest;
}

export const fetchUserVotes = async (
  blockNumber: bigint,
  userAddresses: string[],
): Promise<VoteResponse[]> => {
  const publicClient = client;

  const balanceCalls = userAddresses.map((userAddress) => ({
    address: VE_NILE_ADDRESS,
    name: "balanceOf",
    params: [userAddress],
  }));

  const userBalances = await batchMulticall(
    publicClient,
    veNILEAbi as Abi,
    balanceCalls,
    blockNumber,
    200,
    2000,
  );

  const tokenCalls: any = [];
  userBalances.forEach((balance, index) => {
    const userAddress = userAddresses[index];
    const userBalance = balance.result as number;

    if (userBalance > 0) {
      for (let i = 0; i < userBalance; i++) {
        tokenCalls.push({
          address: VE_NILE_ADDRESS,
          name: "tokenOfOwnerByIndex",
          params: [userAddress, i],
        });
      }
    }
  });

  const userTokensCalls = await batchMulticall(
    publicClient,
    veNILEAbi as Abi,
    tokenCalls,
    blockNumber,
    500,
    200,
  );

  const detailsCalls = userTokensCalls.map((call) => ({
    address: VE_NILE_ADDRESS,
    name: "locked",
    params: [call.result],
  }));

  const res = (await batchMulticall(
    publicClient,
    veNILEAbi as Abi,
    detailsCalls,
    blockNumber,
    200,
    2000,
  )) as any;

  return res.map((r: any, index: any) => {
    const userAddress = userAddresses[Math.floor(index / tokenCalls.length)];
    return { result: { amount: r.result[0], userAddress } };
  }) as VoteResponse[];
};

async function batchMulticall(
  publicClient: PublicClient,
  abi: Abi,
  calls: any[],
  blockNumber: bigint,
  batchSize: number,
  delay: number,
) {
  const results = [];

  for (let i = 0; i < calls.length; i += batchSize) {
    const batch = calls.slice(i, i + batchSize);

    const call: MulticallParameters = {
      contracts: batch.map((call) => ({
        address: call.address as Address,
        abi,
        functionName: call.name,
        args: call.params,
      })),
      blockNumber,
    };

    const res = await publicClient.multicall(call);
    results.push(...res);

    if (i + batchSize < calls.length) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return results;
}
