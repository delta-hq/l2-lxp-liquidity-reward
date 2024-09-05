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
  agETH
} from "./utils";

export async function getEtherumBlock(blockTimestampSecs: number) {
  const blockTimestampInMill = blockTimestampSecs * 1000;
  const date = new Date(blockTimestampInMill); //
  // External API

  const res = await dater.getDate(date);
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
