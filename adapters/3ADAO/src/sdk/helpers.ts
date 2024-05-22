import { ethers } from "ethers";
import { vaultFactoryHelperABI } from "./ABIs/vaultFactoryHelper";
import { addresses, LINEA_RPC, whitelistedCollaterals } from "./config";
import { balanceGetterABI } from "./ABIs/balanceGetter";
import { vaultABI } from "./ABIs/vault";

// Define types for the ABIs
interface VaultFactoryHelper {
  getAllVaults(
    factoryAddress: string,
    options: { blockTag: number }
  ): Promise<string[]>;
  getVaultTvlByCollateral(
    vaultAddress: string,
    collateral: string,
    options: { blockTag: number }
  ): Promise<ethers.BigNumberish>;
}

interface Vault {
  vaultOwner(options: { blockTag: number }): Promise<string>;
}

interface BalanceGetter {
  getBalances(vaultAddress: string, collaterals: string[]): Promise<number[]>;
}

const provider = new ethers.JsonRpcProvider(LINEA_RPC);

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

  const helper = getVaultFactoryHelper();
  const balanceGetter = getBalanceGetter();

  // Fetch all vault addresses in parallel
  const vaults = await helper.getAllVaults(addresses.vaultFactory, {
    blockTag: blockNumber,
  });

  const owners: string[] = [];
  const vaultsTvl: number[][] = [];
  const balancesByVault: number[][] = [];
  const collateralsByVaults: string[][] = [];

  // Process each vault concurrently
  const vaultPromises = vaults.map(async (vaultAddress: string) => {
    const vault = getVault(vaultAddress);

    const vaultOwnerPromise = vault.vaultOwner({ blockTag: blockNumber });

    const tvlByCollateralPromises = whitelistedCollaterals.map(
      async (collateral: string) => {
        const collateralTvl = await helper.getVaultTvlByCollateral(
          vaultAddress,
          collateral,
          {
            blockTag: blockNumber,
          }
        );
        return {
          collateral,
          tvl:
            Number(collateralTvl) > 0
              ? Number(ethers.formatEther(collateralTvl))
              : 0,
        };
      }
    );

    const [vaultOwner, tvlByCollateralResults] = await Promise.all([
      vaultOwnerPromise,
      Promise.all(tvlByCollateralPromises),
    ]);

    const tvlByCollateral: number[] = [];
    const usedCollaterals: string[] = [];
    tvlByCollateralResults.forEach(({ collateral, tvl }) => {
      if (tvl > 0) {
        tvlByCollateral.push(tvl);
        usedCollaterals.push(collateral);
      }
    });

    const balances =
      usedCollaterals.length > 0
        ? await balanceGetter.getBalances(vaultAddress, usedCollaterals)
        : [];

    owners.push(vaultOwner);
    vaultsTvl.push(tvlByCollateral);
    collateralsByVaults.push(usedCollaterals);
    balancesByVault.push(balances);
  });

  await Promise.all(vaultPromises);

  return {
    vaultsTvl,
    owners,
    collateralsByVaults,
    balancesByVault,
  };
};

// // Usage example
// getTvlByVaultAtBlock(4243360)
//   .then((result) => console.log(result))
//   .catch((error) => console.error(error));
