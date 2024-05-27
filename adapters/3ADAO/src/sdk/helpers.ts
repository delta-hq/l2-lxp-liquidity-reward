import { ethers } from "ethers";
import { vaultFactoryHelperABI } from "./ABIs/vaultFactoryHelper";
import {
  addresses,
  LINEA_RPC1,
  LINEA_RPC2,
  LINEA_RPC3,
  LINEA_RPC4,
  LINEA_RPC5,
  whitelistedCollaterals,
} from "./config";
import { balanceGetterABI } from "./ABIs/balanceGetter";
import { vaultABI } from "./ABIs/vault";

// Define types for the ABIs
interface VaultFactoryHelper {
  getAllVaults(
    factoryAddress: string,
    options: { blockNumber: number }
  ): Promise<string[]>;
  getVaultTvlByCollateral(
    vaultAddress: string,
    collateral: string,
    options: { blockNumber: number }
  ): Promise<ethers.BigNumberish>;
}

interface Vault {
  vaultOwner(options: { blockNumber: number }): Promise<string>;
}

interface BalanceGetter {
  getBalances(vaultAddress: string, collaterals: string[]): Promise<number[]>;
}

const switchProvider = () => {
  providerIndex = (providerIndex + 1) % providers.length;
  provider = providers[providerIndex];
};

const provider1 = new ethers.JsonRpcProvider(LINEA_RPC1);
const provider2 = new ethers.JsonRpcProvider(LINEA_RPC2);
const provider3 = new ethers.JsonRpcProvider(LINEA_RPC3);
const provider4 = new ethers.JsonRpcProvider(LINEA_RPC4);
const provider5 = new ethers.JsonRpcProvider(LINEA_RPC4);

const providers = [provider1, provider2, provider3, provider4, provider5];
let providerIndex = 0;
let provider = providers[providerIndex];

const getVaultFactoryHelper = (): VaultFactoryHelper => {
  return new ethers.Contract(
    addresses.vaultFactoryHelper,
    vaultFactoryHelperABI,
    provider
  ) as unknown as VaultFactoryHelper;
};

const getVault = (address: string): Vault => {
  return new ethers.Contract(address, vaultABI, provider) as unknown as Vault;
};

const getBalanceGetter = (): BalanceGetter => {
  return new ethers.Contract(
    addresses.balanceGetter,
    balanceGetterABI,
    provider
  ) as unknown as BalanceGetter;
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
  const creationFactoryBlock = 3045954; // Check to avoid not finding the contract

  if (blockNumber <= creationFactoryBlock) {
    throw new Error(
      "Block number is too early, before the creation factory block."
    );
  }

  try {
    const helper = getVaultFactoryHelper();
    const balanceGetter = getBalanceGetter();

    // Fetch all vault addresses in parallel
    const vaults = await helper.getAllVaults(addresses.vaultFactory, {
      blockNumber: blockNumber,
    });

    const ownerCollateralMap: Record<string, Record<string, number>> = {};
    const ownerBalancesMap: Record<string, Record<string, number>> = {};

    // Process each vault concurrently
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
          const collateralTvl = await helper.getVaultTvlByCollateral(
            vaultAddress,
            collateral,
            {
              blockNumber,
            }
          );
          return {
            collateral,
            tvl:
              Number(collateralTvl) > 0
                ? Number(ethers.formatEther(collateralTvl))
                : 0,
          };
        });

      const [vaultOwner, tvlByCollateralResults] = await Promise.all([
        vaultOwnerPromise,
        Promise.all(tvlByCollateralPromises),
      ]);

      if (!ownerCollateralMap[vaultOwner]) {
        ownerCollateralMap[vaultOwner] = {};
      }

      if (!ownerBalancesMap[vaultOwner]) {
        ownerBalancesMap[vaultOwner] = {};
      }

      const usedCollaterals: string[] = [];
      tvlByCollateralResults.forEach(({ collateral, tvl }) => {
        if (tvl > 0) {
          if (!ownerCollateralMap[vaultOwner][collateral]) {
            ownerCollateralMap[vaultOwner][collateral] = 0;
          }
          ownerCollateralMap[vaultOwner][collateral] += tvl;
          usedCollaterals.push(collateral);
        }
      });

      const balances =
        usedCollaterals.length > 0
          ? await balanceGetter.getBalances(vaultAddress, usedCollaterals)
          : [];

      balances.forEach((balance, index) => {
        const collateral = usedCollaterals[index];
        if (!ownerBalancesMap[vaultOwner][collateral]) {
          ownerBalancesMap[vaultOwner][collateral] = 0;
        }
        ownerBalancesMap[vaultOwner][collateral] += Number(balance);
      });
    });

    await Promise.all(vaultPromises);

    const owners = Object.keys(ownerCollateralMap);
    const vaultsTvl: number[][] = [];
    const collateralsByVaults: string[][] = [];
    const balancesByVault: number[][] = [];

    owners.forEach((owner) => {
      const collaterals = Object.keys(ownerCollateralMap[owner]);
      const tvl = collaterals.map(
        (collateral) => ownerCollateralMap[owner][collateral]
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

// // Usage example
// getTvlByVaultAtBlock(4243360)
//   .then((result) => console.log(result))
//   .catch((error) => console.error(error));
