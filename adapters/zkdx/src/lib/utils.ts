import {Contract, ethers} from "ethers";
import {GraphQLClient} from "graphql-request";

export const USDC = "0x176211869ca2b568f2a7d4ee941e073a821ee1ff";
export const WETH = "0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f";
export const EXCHANGER = "0x3a85b87e81cd99d4a6670f95a4f0dedaac207da0";
export const ZUSD = "0x2167C4D5FE05A1250588F0B8AA83A599e7732eae"

export const assets: { [key: string]: string } = {
    "0x176211869ca2b568f2a7d4ee941e073a821ee1ff": "USDC",
    "0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f": "WETH",
};

export const providerLinea = new ethers.providers.JsonRpcProvider("https://rpc.linea.build")
export const graphClient = new GraphQLClient("https://api.studio.thegraph.com/query/47302/zkdx-graph-linea/v0.1.1")

const abi = [
    "function balanceOf(address account) public view returns (uint256)",
    "function totalSupply() public view returns (uint256)"
]

export const usdcContract = new Contract(USDC, abi, providerLinea);
export const zusdContract = new Contract(ZUSD, abi, providerLinea);
export const batchSize = 50;