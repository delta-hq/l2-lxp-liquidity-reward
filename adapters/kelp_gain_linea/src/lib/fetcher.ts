import { ethers } from "ethers";
import BigNumber from "bignumber.js";
import {
  chainlinkOracleContract,
  KelpOracleContract as kelpOracleContract,
  kelpGAINLinea,
  rsETHContract,
  dater,
  agETHContract,
  wrsETHContract,
  agETH,
  scrollDater,
  arbDater
} from "./utils";

export async function getEtherumBlock(
  blockTimestampSecs: number
): Promise<number> {
  return retry({
    fn: async () => {
      return await _getEtherumBlock(blockTimestampSecs);
    },
    name: `_getEtherumBlock`
  });
}

export async function getArbBlock(blockTimestampSecs: number): Promise<number> {
  return retry({
    fn: async () => {
      return await _getArbBlock(blockTimestampSecs);
    },
    name: `_getARBBlock`
  });
}

export async function getScrollBlock(
  blockTimestampSecs: number
): Promise<number> {
  return retry({
    fn: async () => {
      return await _getScrollBlock(blockTimestampSecs);
    },
    name: `_getScrollBlock`
  });
}

export async function _getEtherumBlock(blockTimestampSecs: number) {
  const blockTimestampInMill = blockTimestampSecs * 1000;
  const date = new Date(blockTimestampInMill); //
  // External API

  const res = await dater.getDate(date);
  let blockNumber = res.block; // Try to get the exact block number

  return blockNumber;
}

export async function _getScrollBlock(blockTimestampSecs: number) {
  const blockTimestampInMill = blockTimestampSecs * 1000;
  const date = new Date(blockTimestampInMill); //
  // External API

  const res = await scrollDater.getDate(date);
  let blockNumber = res.block; // Try to get the exact block number

  return blockNumber;
}

export async function _getArbBlock(blockTimestampSecs: number) {
  const blockTimestampInMill = blockTimestampSecs * 1000;
  const date = new Date(blockTimestampInMill); //
  // External API

  const res = await arbDater.getDate(date);
  let blockNumber = res.block; // Try to get the exact block number

  return blockNumber;
}

// Total supply - total agETH in the contract
export async function agETHTotalLiquid(blockNumber: number): Promise<bigint> {
  const [totalSupply, locked] = await Promise.all([
    agETHTotalSupply(blockNumber),
    agETHTotalLocked(blockNumber)
  ]);

  return totalSupply - locked;
}

export async function rsETHTotalSupply(blockNumber: number): Promise<bigint> {
  let totalSupply = await rsETHContract.totalSupply({
    blockTag: blockNumber
  });

  return totalSupply;
}

async function agETHTotalSupply(blockNumber: number): Promise<bigint> {
  let totalSupply = await agETHContract.totalSupply({
    blockTag: blockNumber
  });

  return totalSupply;
}

async function agETHTotalLocked(blockNumber: number): Promise<bigint> {
  let lockedAmount = await agETHContract.balanceOf(agETH, {
    blockTag: blockNumber
  });

  return lockedAmount;
}

export async function agETHBalancerOf(
  blockNumber: number,
  address: string
): Promise<bigint> {
  let balance = await agETHContract.balanceOf(address, {
    blockTag: blockNumber
  });

  return balance;
}

export async function getRsETHBalance(blockNumber: number): Promise<bigint> {
  let rsETHBalance = await rsETHContract.balanceOf(kelpGAINLinea, {
    blockTag: blockNumber
  });

  return rsETHBalance;
}

export async function getWRsETHBalance(blockNumber: number): Promise<bigint> {
  let wrsETHBalance = await wrsETHContract.balanceOf(kelpGAINLinea, {
    blockTag: blockNumber
  });

  return wrsETHBalance;
}

async function getETHPrice(blockNumber: number): Promise<string> {
  const latestAnswer = await chainlinkOracleContract.latestAnswer({
    blockTag: blockNumber
  });

  return latestAnswer;
}

async function rsETHRate(blockNumber: number): Promise<string> {
  const rsETHRate = kelpOracleContract.rate({
    blockTag: blockNumber
  });
  return rsETHRate;
}

async function decimals(blockNumber: number): Promise<string> {
  const decimals = await chainlinkOracleContract.decimals({
    blockTag: blockNumber
  });

  return decimals;
}

// Giving rsETH, return agETH
export async function rsEthToAgEth(blockNumber: number): Promise<bigint> {
  const rate = await agETHContract.convertToShares(BigInt(10 ** 18), {
    blockTag: blockNumber
  });

  return rate;
}
// Giving agETH, return rsETH
export async function agEthToRsEth(blockNumber: number): Promise<bigint> {
  const rate = await agETHContract.convertToAssets(BigInt(10 ** 18), {
    blockTag: blockNumber
  });

  return rate;
}

export async function getRsETHPrice(blockNumber: number): Promise<BigNumber> {
  const [rsEthRateRaw, ethPriceRaw, ethPriceDec] = await Promise.all([
    rsETHRate(blockNumber),
    getETHPrice(blockNumber),
    decimals(blockNumber)
  ]);

  let rsEthRate = new BigNumber(ethers.utils.formatEther(rsEthRateRaw));
  let ethPrice = new BigNumber(
    ethers.utils.formatUnits(ethPriceRaw, ethPriceDec)
  );

  return rsEthRate.times(ethPrice);
}

/**
 * A wrapper function that retries a function that returns a promise of some resource
 * @param fn - The function that returns a promise of some resource
 * @param retries - The number of times to retry the function
 * @param delayInSecs - The delay between retries in seconds
 * @returns - A promise of the resource
 */
export async function retry<T>({
  fn,
  retries = 10,
  delayInSecs = 1000,
  name = "Function"
}: SimpleRetry<T>): Promise<T> {
  let currentAttempt = 0;
  do {
    try {
      const res = await fn();
      return res as T;
    } catch (error) {
      currentAttempt++;
      console.log(
        `Error in retry(${name}):  Retry count ${currentAttempt}`,
        error
      );
    }
    await wait(delayInSecs);
  } while (currentAttempt <= retries);

  throw new Error(`Error in retry(${name})`);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type SimpleRetry<T> = {
  fn: () => T | Promise<T>;
  retries?: number;
  delayInSecs?: number;
  name?: string;
};
