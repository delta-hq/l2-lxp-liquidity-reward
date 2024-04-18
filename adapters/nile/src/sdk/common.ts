import BigNumber from "bignumber.js";
import { client } from "./config";

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
