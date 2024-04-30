import { createPublicClient, http } from 'viem';
import { linea } from 'viem/chains';

export const enum CHAINS{
    MODE = 34443,
    LINEA = 59144,
}
export const enum PROTOCOLS{
    SUPSWAP = 0,
    IZISWAP = 1,
}

export const enum AMM_TYPES{
    UNISWAPV3 = 0,
    IZISWAP = 1
}

export const SUBGRAPH_URLS = {
    [CHAINS.MODE]: {
        [PROTOCOLS.IZISWAP]: {
            [AMM_TYPES.IZISWAP]: "https://graph-node-api.izumi.finance/query/subgraphs/name/izi-swap-mode"
        }
    },
    [CHAINS.LINEA]: {
        [PROTOCOLS.IZISWAP]: {
            [AMM_TYPES.IZISWAP]: "https://api.studio.thegraph.com/query/24334/izumi-subgraph-linea/version/latest"
        }
    }
}
export const RPC_URLS = {
    [CHAINS.MODE]: "https://rpc.goldsky.com",
    [CHAINS.LINEA]: "https://rpc.linea.build",
}

export const client = createPublicClient({
    chain: linea,
    transport: http(RPC_URLS[CHAINS.LINEA]),
  });

export const FARM_CONTRACTS = ['0xbe138ad5d41fdc392ae0b61b09421987c1966cc3']

export const OWNERS_ABI = [{
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "owners",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }] as const