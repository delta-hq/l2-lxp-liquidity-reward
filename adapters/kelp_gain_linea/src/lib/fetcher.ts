import { ethers, utils } from "ethers";
import BigNumber from "bignumber.js";
import {
  chainlinkOracleContract,
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
