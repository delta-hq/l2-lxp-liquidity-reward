import { Contract, ethers } from "ethers";
import EthDater from "ethereum-block-by-date";

export const rsETH = "0x4186BFC76E2E237523CBC30FD220FE055156b41F";
export const kelpGAIN = "0x4DCb388488622e47683EAd1a147947140a31e485";
export const kelpOracle = "0x349A73444b1a310BAe67ef67973022020d70020d";
export const chainLinkOracle = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
const ETH_RPC = "https://eth.llamarpc.com";

const ethProvider = new ethers.providers.JsonRpcProvider(ETH_RPC);

export const providerLinea = new ethers.providers.JsonRpcProvider(
  "https://rpc.linea.build"
);

const rsEthAbi = [
  "function balanceOf(address account) public view returns (uint256)"
];

const kelpOracleAbi = ["function rsETHPrice() public view returns (uint256)"];

const chainlinkOracleAbi = [
  "function latestAnswer() public view returns (uint256)",
  "function decimals() public view returns (uint256)"
];

export const dater = new EthDater(ethProvider);

export const rsETHContract = new Contract(rsETH, rsEthAbi, providerLinea);
export const KelpOracleContract = new Contract(
  kelpOracle,
  kelpOracleAbi,
  ethProvider
);

export const chainlinkOracleContract = new Contract(
  chainLinkOracle,
  chainlinkOracleAbi,
  ethProvider
);

export const batchSize = 50;
