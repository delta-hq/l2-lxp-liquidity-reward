import { gql } from "@apollo/client";

export const TRANSFERS_QUERY = gql`
  query GetLiquidityTransfers($blockNumber: Int!, $first: Int!, $skip: Int!) {
    transfers(
      first: $first
      skip: $skip
      where: { block_number_lte: $blockNumber }
    ) {
      from
      to
      value
      contractId_
      transactionHash_
    }
  }
`;

export const SYNCS_QUERY = gql`
  query GetSyncs($blockNumber: Int!, $contractId: String!) {
    syncs(
      where: {
        block_number_lte: $blockNumber
        contractId__contains: $contractId
      }
      orderBy: timestamp_
      orderDirection: desc
      first: 1
    ) {
      contractId_
      reserve0
      reserve1
    }
  }
`;
