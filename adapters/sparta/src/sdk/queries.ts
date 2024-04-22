import { gql } from "@apollo/client";

export const TRANSFERS_QUERY = gql`
  query GetLiquidityTransfers($blockNumber: Int!) {
    transfers(where: { block_number_lte: $blockNumber }) {
      from
      to
      value
      contractId_
      transactionHash_
    }
  }
`;

export const SYNCS_QUERY = gql`
  query GetSyncs($blockNumber: Int!) {
    syncs(
      where: { block_number_lte: $blockNumber }
      orderBy: timestamp_
      orderDirection: desc
    ) {
      contractId_
      reserve0
      reserve1
    }
  }
`;
