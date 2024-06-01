import BigNumber from "bignumber.js";
import { client } from "./config";
import { Abi } from 'viem';

export const fromWei = (number: number | string, decimals = 18) =>
  new BigNumber(number).div(new BigNumber(10).pow(decimals));
export const toWei = (number: number | string, decimals = 18) =>
  new BigNumber(number).times(new BigNumber(10).pow(decimals));

export const getTimestampAtBlock = async (blockNumber: number) => {
  const block = await client.getBlock({
    blockNumber: BigInt(blockNumber),
  });
  return Number(block.timestamp * 1000n);
};

export const getSickleOwners = async (sickleAddresses: `0x${string}`[]): Promise<Record<string, string>> => {
  const abi: Abi = [
    {
      inputs: [],
      name: 'owner',
      outputs: [{ internalType: 'address', name: '', type: 'address' }],
      stateMutability: 'view',
      type: 'function',
    },
  ] as const;

  const results = await client.multicall({
    allowFailure: false,
    contracts: sickleAddresses.map(
      (sickle) =>
        ({
          abi,
          address: sickle,
          functionName: 'owner',
          args: [],
        } as const),
    ),
  });

  const resultsArray = results as string[];

  const sickleOwners: Record<string, string> = {};
  for (let i = 0; i < sickleAddresses.length; i++) {
    sickleOwners[sickleAddresses[i]] = resultsArray[i];
  }
  
  return sickleOwners;
};
