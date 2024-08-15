import { ethers, utils } from "ethers";
import BigNumber from "bignumber.js";
import {
  chainlinkOracleContract,
  dater,
  KelpOracleContract as kelpOracleContract,
  kelpGAIN,
  rsETHContract
} from "./utils";

export async function getRsETHBalance(blockNumber: number): Promise<BigNumber> {
  let rsETHBalance = await rsETHContract.balanceOf(kelpGAIN, {
    blockTag: blockNumber
  });

  return new BigNumber(ethers.utils.formatEther(rsETHBalance));
}

async function getETHPrice(blockNumber: number): Promise<string> {
  return chainlinkOracleContract.latestAnswer({
    blockTag: blockNumber
  });
}

export async function getRsETHPrice(blockNumber: number): Promise<BigNumber> {
  const [rsEthRateRaw, ethPriceRaw, ethPriceDec] = await Promise.all([
    kelpOracleContract.rsETHPrice({
      blockTag: blockNumber
    }),
    getETHPrice(blockNumber),
    chainlinkOracleContract.decimals({
      blockTag: blockNumber
    })
  ]);

  let rsEthRate = new BigNumber(ethers.utils.formatEther(rsEthRateRaw));
  let ethPrice = new BigNumber(
    ethers.utils.formatUnits(ethPriceRaw, ethPriceDec)
  );

  return rsEthRate.times(ethPrice);
}

export async function getBlockToRunTheJob(blockTimestampSecs: number) {
  const blockTimestampInMill = blockTimestampSecs * 1000;
  const date = new Date(blockTimestampInMill); //
  // External API

  const res = dater.getDate(date);
  let blockNumber = res.block; // Try to get the exact block number

  return blockNumber;
}
