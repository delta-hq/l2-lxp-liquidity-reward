import { gql } from "@apollo/client";

export const LIQUIDITY_QUERY = gql`
  query GetLiquidityBalances($blockNumber: Int!) {
    mints(where: { block_number_lte: $blockNumber }) {
      amount0
      amount1
      contractId_
      transactionHash_
    }
    burns(where: { block_number_lte: $blockNumber }) {
      to
      amount0
      amount1
      contractId_
      transactionHash_
    }
  }
`;

export const TOKEN_TRANSFERS_QUERY = gql`
  query GetLiquidityTransfers($tx: String!) {
    transfer1S(where: { transactionHash__contains: $tx }) {
      from
      contractId_
    }
  }
`;
