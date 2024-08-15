import { Contract, ethers } from "ethers";

export const rsETH = "0x4186BFC76E2E237523CBC30FD220FE055156b41F";
export const kelpGAIN = "0x4DCb388488622e47683EAd1a147947140a31e485";
export const kelpOracle = "0x81E5c1483c6869e95A4f5B00B41181561278179F";
export const chainLinkOracle = "0x3c6Cd9Cc7c7a4c2Cf5a82734CD249D7D593354dA";

export const providerLinea = new ethers.providers.JsonRpcProvider(
  "https://rpc.linea.build"
);

const rsEthAbi = [
  "function balanceOf(address account) public view returns (uint256)"
];

const kelpOracleAbi = ["function rate() public view returns (uint256)"];

const chainlinkOracleAbi = [
  "function latestAnswer() public view returns (uint256)",
  "function decimals() public view returns (uint256)"
];

export const rsETHContract = new Contract(rsETH, rsEthAbi, providerLinea);
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
