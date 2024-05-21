import { ethers } from "ethers";
import { vaultFactoryHelperABI } from "./ABIs/vaultFactoryHelper";
import { addresses, LINEA_RPC, whitelistedCollaterals } from "./config";
import { balanceGetterABI } from "./ABIs/balanceGetter";
import { vaultABI } from "./ABIs/vault";

const Provider = new ethers.JsonRpcProvider(LINEA_RPC);

const getVaultFactoryHelper = async () => {
  const Contract = new ethers.Contract(
    addresses.vaultFactoryHelper,
    vaultFactoryHelperABI,
    Provider
  );
  return Contract;
};

const getVault = async (address: string) => {
  const Contract = new ethers.Contract(address, vaultABI, Provider);
  return Contract;
};

const getBalanceGetter = async () => {
  const Contract = new ethers.Contract(
    addresses.balanceGetter,
    balanceGetterABI,
    Provider
  );
  return Contract;
};

export const getTvlByVaultAtBlock = async (blockNumber: number) => {
  const creationFactoryBlock = 3045954; // Check to avoid not finding the contract

  const owners = [];
  const vaultsTvl = [];
  // const vaultAddresses = [];
  const balancesByVault = [];
  const collateralsByVaults = [];

  if (blockNumber > creationFactoryBlock) {
    const Helper = await getVaultFactoryHelper();
    const BalanceGetter = await getBalanceGetter();

    const vaults = await Helper.getAllVaults(addresses.vaultFactory, {
      blockTag: blockNumber,
    });
    // vaultAddresses.push(vaults);
    for (let i = 0; i < vaults.length; i++) {
      const tvlByCollateral = [];
      const vaultAddress = vaults[i];
      const collateralsBySingleVault = [];
      const vault = await getVault(vaultAddress);

      const vaultOwner = await vault.vaultOwner({ blockTag: blockNumber });
      owners.push(vaultOwner);
      for (let j = 0; j < whitelistedCollaterals.length; j++) {
        const collateralTvl = await Helper.getVaultTvlByCollateral(
          vaultAddress,
          whitelistedCollaterals[j],
          {
            blockTag: blockNumber,
          }
        );

        if (Number(collateralTvl) > 0) {
          const collateralTvlFormated = Number(
            ethers.formatEther(collateralTvl)
          );
          tvlByCollateral.push(collateralTvlFormated);

          collateralsBySingleVault.push(whitelistedCollaterals[j]);
        }
      }
      collateralsByVaults.push(collateralsBySingleVault);
      if (collateralsBySingleVault.length != 0) {
        balancesByVault.push(
          await BalanceGetter.getBalances(vaults[i], collateralsBySingleVault)
        );
      } else {
        balancesByVault.push([]);
      }
      vaultsTvl.push(tvlByCollateral);
    }
  }

  return {
    vaultsTvl,
    owners,
    collateralsByVaults,
    // vaultAddresses,
    balancesByVault,
  };
};
