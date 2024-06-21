export const BEEFY_VAULT_API = "https://api.beefy.finance/harvestable-vaults";

// subgraph source: https://github.com/beefyfinance/l2-lxp-liquidity-subgraph
export const BEEFY_SUBGRAPH_URL =
  "https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefy-balances-linea/latest/gn";

export const SUBGRAPH_PAGE_SIZE = 1000;

export const RPC_URLS = (
  process.env.RPC_URLS ?? "https://rpc.linea.build,https://rpc.linea.build"
).split(",");
