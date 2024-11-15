import { Contract, ethers } from "ethers";
import EthDater from "ethereum-block-by-date";
export const rsETH = "0x4186BFC76E2E237523CBC30FD220FE055156b41F";
export const wrsETH = "0xD2671165570f41BBB3B0097893300b6EB6101E6C";
export const agETH = "0xe1B4d34E8754600962Cd944B535180Bd758E6c2e";
export const kelpGAINLinea = "0x4DCb388488622e47683EAd1a147947140a31e485";
export const kelpOracle = "0x81E5c1483c6869e95A4f5B00B41181561278179F";
export const chainLinkOracle = "0x3c6Cd9Cc7c7a4c2Cf5a82734CD249D7D593354dA";

export const pendleSYAgETH = "0xb1b9150f2085f6a553b547099977181ca802752a"; //20561468 (Aug-19-2024 08:25:59 AM UTC
export const balancerVault = "0xba12222222228d8ba445958a75a0704d566bf2c8"; //20520908 (Aug-13-2024 04:30:35 PM UTC) // 0xF1BBC5d95cD5Ae25AF9916b8a193748572050EB0 (Balancer agETH / rsETH (agETH / rsETH))

export const SPECTRA_START_BLOCK = 20521549;
export const BALANCER_START_BLOCK = 20520908;
export const PENDLE_START_BLOCK = 20561468;
export const AGETH_BLOCK = 20483695;
export const YAY_START_BLOCK = 20833064;

export const NURI_START_TIMESTAMP = 1727716475; // scroll block 9751486 Sep-30-2024 05:14:35 PM UTC
export const NILE_START_BLOCK = 10144961; //  linea block 10144961 Sep-30-2024 04:29:28 PM UTC
export const CAMELOT_START_TIMESTAMP = 1727719180; // arb block 258999746 Sep-30-2024 05:59:40 PM +UTC

const ethProvider = new ethers.providers.JsonRpcProvider(
  "https://eth.llamarpc.com"
);

const scrollProvider = new ethers.providers.JsonRpcProvider(
  "https://rpc.scroll.io/"
);

const arbProvider = new ethers.providers.JsonRpcProvider(
  "https://arb1.arbitrum.io/rpc"
);

export const dater = new EthDater(ethProvider);
export const scrollDater = new EthDater(scrollProvider);
export const arbDater = new EthDater(arbProvider);

export const providerLinea = new ethers.providers.JsonRpcProvider(
  "https://rpc.linea.build"
);

const rsEthAbi = [
  "function balanceOf(address account) public view returns (uint256)",
  "function totalSupply() public view returns (uint256)"
];

const agEthAbi = [
  "function convertToShares(uint256 shares) public view returns (uint256)",
  "function convertToAssets(uint256 shares) public view returns (uint256)",
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
