import { Abi, Address, MulticallParameters, PublicClient } from "viem";
import { client } from "./config";
import veNILEAbi from "./abis/veNILE.json";

export const VE_NILE_ADDRESS = "0xaaaea1fb9f3de3f70e89f37b69ab11b47eb9ce6f"; // veNILE

export interface VoteRequest {
  userAddress: string;
  amount: bigint;
}

export interface VoteResponse {
  result: VoteRequest;
}

export const fetchUserVotes = async (
  blockNumber: bigint,
  userAddress: string,
): Promise<VoteResponse[]> => {
  const publicClient = client;

  const userBalanceCall = await multicall(
    publicClient,
    veNILEAbi as Abi,
    [
      {
        address: VE_NILE_ADDRESS,
        name: "balanceOf",
        params: [userAddress],
      },
    ],
    blockNumber,
  );

  const userBalance = userBalanceCall[0].result as number;

  if (userBalance === 0) return [];

  const calls = [];
  for (let i = 0; i < userBalance; i++) {
    calls.push({
      address: VE_NILE_ADDRESS,
      name: "tokenOfOwnerByIndex",
      params: [userAddress, i],
    });
  }

  const userTokensCalls = await multicall(
    publicClient,
    veNILEAbi as Abi,
    calls,
    blockNumber,
  );

  const detailsCall = userTokensCalls.map((call) => {
    return {
      address: VE_NILE_ADDRESS,
      name: "balanceOfNFT",
      params: [call.result],
    };
  });

  const res = (await multicall(
    publicClient,
    veNILEAbi as Abi,
    detailsCall,
    blockNumber,
  )) as any;

  return res.map((r: any) => {
    return { result: { amount: r.result, userAddress } };
  }) as VoteResponse[];
};

function multicall(
  publicClient: PublicClient,
  abi: Abi,
  calls: any[],
  blockNumber: bigint,
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
