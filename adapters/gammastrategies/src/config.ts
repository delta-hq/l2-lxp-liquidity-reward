export const PAGE_SIZE = 1000;

export const enum PROTOCOLS {
    UNISWAP = 0,
    LYNEX = 1,
    LINEHUB = 2,
    NILE = 3,
  }

export const SUBGRAPH_URLS = {
    [PROTOCOLS.UNISWAP]:
      "https://api.goldsky.com/api/public/project_clols2c0p7fby2nww199i4pdx/subgraphs/gamma-uniswap-linea/latest/gn",
    [PROTOCOLS.LYNEX]:
      "https://api.goldsky.com/api/public/project_clols2c0p7fby2nww199i4pdx/subgraphs/gamma-lynex-linea/latest/gn",
    [PROTOCOLS.LINEHUB]:
      "https://api.goldsky.com/api/public/project_clols2c0p7fby2nww199i4pdx/subgraphs/gamma-linehub-linea/latest/gn",
    [PROTOCOLS.NILE]:
      "https://api.goldsky.com/api/public/project_clols2c0p7fby2nww199i4pdx/subgraphs/gamma-nile-linea/latest/gn",
  };
  
