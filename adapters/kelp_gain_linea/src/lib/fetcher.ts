import { ethers } from "ethers";
import BigNumber from "bignumber.js";
import {
  chainlinkOracleContract,
  KelpOracleContract as kelpOracleContract,
  kelpGAIN,
  rsETHContract,
  dater,
  agETHContract,
  rsETH
} from "./utils";

export async function getEtherumBlock(blockTimestampSecs: number) {
  const blockTimestampInMill = blockTimestampSecs * 1000;
  const date = new Date(blockTimestampInMill); //
  // External API

  const res = await dater.getDate(date);
  let blockNumber = res.block; // Try to get the exact block number

  return blockNumber;
}

export async function getRsETHBalance(blockNumber: number): Promise<string> {
  let rsETHBalance = await rsETHContract.balanceOf(kelpGAIN, {
    blockTag: blockNumber
  });

  return rsETHBalance;
}

async function getETHPrice(blockNumber: number): Promise<string> {
  const latestAnswer = await chainlinkOracleContract.latestAnswer({
    blockTag: blockNumber
  });

  return latestAnswer;
}

async function decimals(blockNumber: number): Promise<string> {
  const decimals = await chainlinkOracleContract.decimals({
    blockTag: blockNumber
  });

  return decimals;
}

export async function agConvertToAssets(blockNumber: number): Promise<string> {
  const rate: string = await agETHContract.convertToAssets(BigInt(10 ** 18), {
    blockTag: blockNumber
  });

  return rate;
}
export async function getRsETHPrice(blockNumber: number): Promise<BigNumber> {
  const [rsEthRateRaw, ethPriceRaw, ethPriceDec] = await Promise.all([
    kelpOracleContract.rate({
      blockTag: blockNumber
    }),
    getETHPrice(blockNumber),
    decimals(blockNumber)
  ]);

  let rsEthRate = new BigNumber(ethers.utils.formatEther(rsEthRateRaw));
  let ethPrice = new BigNumber(
    ethers.utils.formatUnits(ethPriceRaw, ethPriceDec)
  );

  return rsEthRate.times(ethPrice);
}
