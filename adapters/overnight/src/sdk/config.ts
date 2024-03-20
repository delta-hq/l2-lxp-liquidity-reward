export const enum CHAINS{
  LINEA = 59144,
}
export const enum PROTOCOLS{
  OVN = 1
}

export const enum AMM_TYPES{
  UNISWAPV3 = 0,
}

export const enum OVNPOOLS{
  FIRST = 0,
  SECOND = 1,
}

export const SUBGRAPH_URLS = {
  [CHAINS.LINEA]: {
      [PROTOCOLS.OVN]: {
          [OVNPOOLS.FIRST]: {
              url:  "https://api.studio.thegraph.com/query/68020/linea_ovn/version/latest",
              pool: "0xc5f4c5c2077bbbac5a8381cf30ecdf18fde42a91"
          },
          [OVNPOOLS.SECOND]: {
              url:  "https://api.studio.thegraph.com/query/68020/ovn_linea_2/version/latest",
              pool: "0x58aacbccaec30938cb2bb11653cad726e5c4194a"
          } 
      }
  }
}

export const RPC_URLS = {
  [CHAINS.LINEA]: "https://rpc.linea.build",
};


export const SNAPSHOTS_BLOCKS = [
    2361808, 2505008, 2548208, 2591408, 2677808,
    2721008, 2764208, 2807408, 2850608, 2893808,
    2953808, 3020000
];

export const LP_LYNEX = "0x63349BA5E1F71252eCD56E8F950D1A518B400b60"
