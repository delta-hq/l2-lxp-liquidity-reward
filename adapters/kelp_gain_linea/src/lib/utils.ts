import { Contract, ethers } from "ethers";
import EthDater from "ethereum-block-by-date";
export const rsETH = "0x4186BFC76E2E237523CBC30FD220FE055156b41F";
export const wrsETH = "0xD2671165570f41BBB3B0097893300b6EB6101E6C";
export const agETH = "0xe1B4d34E8754600962Cd944B535180Bd758E6c2e";
export const kelpGAINLinea = "0x4DCb388488622e47683EAd1a147947140a31e485";
export const kelpOracle = "0x81E5c1483c6869e95A4f5B00B41181561278179F";
export const chainLinkOracle = "0x3c6Cd9Cc7c7a4c2Cf5a82734CD249D7D593354dA";
export const pendleSYAgETH = "0xb1b9150f2085f6a553b547099977181ca802752a";
export const balancerVault = "0xba12222222228d8ba445958a75a0704d566bf2c8";
const ETH_RPC = "https://eth.llamarpc.com";

const ethProvider = new ethers.providers.JsonRpcProvider(ETH_RPC);

export const dater = new EthDater(ethProvider);

export const providerLinea = new ethers.providers.JsonRpcProvider(
  "https://rpc.linea.build"
);

const rsEthAbi = [
  "function balanceOf(address account) public view returns (uint256)"
];

const agEthAbi = [
  "function convertToShares(uint256 shares) public view returns (uint256)",
  "function totalSupply() public view returns (uint256)",
  "function balanceOf(address account) public view returns (uint256)"
];

const kelpOracleAbi = ["function rate() public view returns (uint256)"];

const chainlinkOracleAbi = [
  "function latestAnswer() public view returns (uint256)",
  "function decimals() public view returns (uint256)"
];

export const rsETHContract = new Contract(rsETH, rsEthAbi, providerLinea);
export const wrsETHContract = new Contract(wrsETH, rsEthAbi, providerLinea);
export const agETHContract = new Contract(agETH, agEthAbi, ethProvider);
export const KelpOracleContract = new Contract(
  kelpOracle,
  kelpOracleAbi,
  providerLinea
);

export const chainlinkOracleContract = new Contract(
  chainLinkOracle,
  chainlinkOracleAbi,
  providerLinea
);
