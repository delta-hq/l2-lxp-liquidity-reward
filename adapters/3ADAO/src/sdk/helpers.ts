import { ethers } from "ethers";
import { vaultFactoryHelperABI } from "./ABIs/vaultFactoryHelper";
import { addresses, LINEA_RPC } from "./config";
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

export const getTvlByVaultAtBlock = async (blockNumber: number) => {
  const creationFactoryBlock = 3045954; // Check to avoid not finding the contract

  const tvls = [];
  const owners = [];

  if (blockNumber > creationFactoryBlock) {
    const Helper = await getVaultFactoryHelper();

    const vaults = await Helper.getAllVaults(addresses.vaultFactory, {
      blockTag: blockNumber,
    });

    for (let i = 0; i < vaults.length; i++) {
      const vaultAddress = vaults[i];
      const vault = await getVault(vaultAddress);
      const vaultOwner = await vault.vaultOwner({ blockTag: blockNumber });
      const vaultTvl = await Helper.getVaultTvl(vaultAddress, {
        blockTag: blockNumber,
      });
      const vaultTvlFormated = Number(ethers.formatEther(vaultTvl));
      owners.push(vaultOwner);
      tvls.push(vaultTvlFormated);
    }
  }
  return { tvls, owners };
};
