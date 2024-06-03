export const enum CHAINS{
  LINEA = 59144,
}
export const enum PROTOCOLS{
  OVN = 1,
}

export const enum AMM_TYPES{
  UNISWAPV3 = 0,
}

export const enum OVN_CONTRACTS{
  USDPLUS = 0,
  USDTPLUS = 1,
}

export const SUBGRAPH_URLS = {
  [CHAINS.LINEA]: {
      [PROTOCOLS.OVN]: {
        [OVN_CONTRACTS.USDPLUS]: {
            url:  "https://api.studio.thegraph.com/query/68020/ovn_linea_points/version/latest",
            address: "0xB79DD08EA68A908A97220C76d19A6aA9cBDE4376"
        },
        [OVN_CONTRACTS.USDTPLUS]: {
            url:  "https://api.studio.thegraph.com/query/68020/ovn_linea_points_usdt/version/latest",
            address: "0x1E1F509963A6D33e169D9497b11c7DbFe73B7F13"
        },
      },
  }
}

export const RPC_URLS = {
  [CHAINS.LINEA]: "https://linea.drpc.org",
};


// export const SNAPSHOTS_BLOCKS = [
//     2361808, 2505008, 2548208, 2591408, 2677808,
//     2721008, 2764208, 2807408, 2850608, 2893808,
//     2953808, 3020000
// ];


export const SNAPSHOTS_BLOCKS = [
  0, 5119650
];

export const CHUNKS_SPLIT = 20;
export const BLOCK_STEP = 5000;
export const LINEA_RPC = "https://lb.drpc.org/ogrpc?network=linea&dkey=AsCWb9aYukugqNphr9pEGw5L893HadYR7ooVbrjxQOzW"
export const LP_LYNEX_SYMBOL = "oLYNX";
export const LP_LYNEX = "0x63349BA5E1F71252eCD56E8F950D1A518B400b60"

export const USD_PLUS_SYMBOL = "usd+"
export const USDT_PLUS_SYMBOL = "usdt+"
export const USD_PLUS_LINEA = "0xB79DD08EA68A908A97220C76d19A6aA9cBDE4376"
export const USDT_PLUS_LINEA = "0x1E1F509963A6D33e169D9497b11c7DbFe73B7F13"
export const ZERO_ADD = "0x0000000000000000000000000000000000000000";