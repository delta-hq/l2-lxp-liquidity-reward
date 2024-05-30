import { ethers } from "ethers";
import { vaultABI } from "./ABIs/vault";
import { surgeHelperABI } from "./ABIs/surgeHelper";
import { receiptTokens } from "./config";
import {
  addresses,
  LINEA_RPC1,
  LINEA_RPC2,
  LINEA_RPC3,
  LINEA_RPC4,
  LINEA_RPC5,
  whitelistedCollaterals,
} from "./config";

interface IVault {
  vaultOwner(options: { blockNumber: number }): Promise<string>;
}

interface IBalanceGetter {
  getBalances(vaultAddress: string, collaterals: string[]): Promise<number[]>;
}

interface ISurgeHelper {
  getAllVaults(
    factoryAddress: string,
    options: { blockNumber: number }
  ): Promise<string[]>;
  getVaultTVLAndUnderlyingAmount(
    vaultAddress: string,
    collateral: string,
    options: { blockNumber: number }
  ): Promise<any>;
  getVaultTVLAndCollateralAmount(
    vaultAddress: string,
    collateral: string,
    options: { blockNumber: number }
  ): Promise<any>;
}

const switchProvider = () => {
  providerIndex = (providerIndex + 1) % providers.length;
  provider = providers[providerIndex];
};

const provider1 = new ethers.JsonRpcProvider(LINEA_RPC1);
const provider2 = new ethers.JsonRpcProvider(LINEA_RPC2);
const provider3 = new ethers.JsonRpcProvider(LINEA_RPC3);
const provider4 = new ethers.JsonRpcProvider(LINEA_RPC4);
const provider5 = new ethers.JsonRpcProvider(LINEA_RPC5);

const providers = [provider1, provider2, provider3, provider4, provider5];
let providerIndex = 0;
let provider = providers[providerIndex];

const getVault = (address: string): IVault => {
  return new ethers.Contract(address, vaultABI, provider) as unknown as IVault;
};

const getSurgeHelper = (): ISurgeHelper => {
  return new ethers.Contract(
    addresses.surgeHelper,
    surgeHelperABI,
    provider
  ) as unknown as ISurgeHelper;
};

interface TVLResult {
  vaultsTvl: number[][];
  owners: string[];
  collateralsByVaults: string[][];
  balancesByVault: number[][];
}

export const getTvlByVaultAtBlock = async (
  blockNumber: number
): Promise<TVLResult> => {
  const creationHelperBlock = 4980087;
  if (blockNumber <= creationHelperBlock) {
    throw new Error(
      `Block number is too early, before the creation surge helper block ${4980087} .`
    );
  }

  try {
    const surgeHelper = getSurgeHelper();

    const vaults = await surgeHelper.getAllVaults(addresses.vaultFactory, {
      blockNumber: blockNumber,
    });

    const ownerTvlCollateralMap: Record<string, Record<string, number>> = {};
    const ownerBalancesMap: Record<string, Record<string, number>> = {};

    const vaultPromises = vaults.map(async (vaultAddress: string) => {
      const vault = getVault(vaultAddress);

      const vaultOwnerPromise = vault.vaultOwner({ blockNumber });

      const whitelistedCollateralsFiltered = Object.fromEntries(
        Object.entries(whitelistedCollaterals).filter(
          ([key]) => Number(key) <= blockNumber
        )
      );

      const tvlByCollateralPromises = Object.values(
        whitelistedCollateralsFiltered
      )
        .flat()
        .map(async (collateral: string) => {
          let collateralTvl;
          let collateralBalance;
          if (receiptTokens[collateral.toUpperCase()]) {
            [collateralTvl, collateralBalance] =
              await surgeHelper.getVaultTVLAndUnderlyingAmount(
                vaultAddress,
                collateral,
                {
                  blockNumber,
                }
              );
          } else {
            [collateralTvl, collateralBalance] =
              await surgeHelper.getVaultTVLAndCollateralAmount(
                vaultAddress,
                collateral,
                {
                  blockNumber,
                }
              );
          }
          return {
            collateral,
            tvl:
              Number(collateralTvl) > 0
                ? Number(ethers.formatEther(collateralTvl))
                : 0,
            balance: Number(collateralBalance),
          };
        });

      const [vaultOwner, collateralResults] = await Promise.all([
        vaultOwnerPromise,
        Promise.all(tvlByCollateralPromises),
      ]);

      if (!ownerTvlCollateralMap[vaultOwner]) {
        ownerTvlCollateralMap[vaultOwner] = {};
      }
      if (!ownerBalancesMap[vaultOwner]) {
        ownerBalancesMap[vaultOwner] = {};
      }

      const usedCollaterals: string[] = [];
      collateralResults.forEach(({ collateral, tvl, balance }) => {
        if (tvl > 0) {
          let collateralUpper = collateral.toUpperCase();

          if (receiptTokens[collateralUpper]) {
            collateralUpper = receiptTokens[collateralUpper].underlying;
          }

          if (!ownerTvlCollateralMap[vaultOwner][collateralUpper]) {
            ownerTvlCollateralMap[vaultOwner][collateralUpper] = 0;
          }
          ownerTvlCollateralMap[vaultOwner][collateralUpper] += tvl;
          if (!usedCollaterals.includes(collateralUpper))
            usedCollaterals.push(collateralUpper);

          if (!ownerBalancesMap[vaultOwner][collateralUpper]) {
            ownerBalancesMap[vaultOwner][collateralUpper] = 0;
          }
          ownerBalancesMap[vaultOwner][collateralUpper] += Number(balance);
        }
      });
    });

    await Promise.all(vaultPromises);

    const owners = Object.keys(ownerTvlCollateralMap);
    const vaultsTvl: number[][] = [];
    const collateralsByVaults: string[][] = [];
    const balancesByVault: number[][] = [];
    owners.forEach((owner) => {
      const collaterals = Object.keys(ownerTvlCollateralMap[owner]);
      const tvl = collaterals.map(
        (collateral) => ownerTvlCollateralMap[owner][collateral]
      );
      const balances = collaterals.map(
        (collateral) => ownerBalancesMap[owner][collateral]
      );

      collateralsByVaults.push(collaterals);
      vaultsTvl.push(tvl);
      balancesByVault.push(balances);
    });

    return {
      vaultsTvl,
      owners,
      collateralsByVaults,
      balancesByVault,
    };
  } catch (error) {
    console.error(
      `Provider ${providerIndex + 1} failed, switching to the next provider.`
    );
    console.log(error);
    switchProvider();
    return getTvlByVaultAtBlock(blockNumber);
  }
};
