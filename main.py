import sys
import pandas as pd
import logging
from argparse import ArgumentParser, Namespace, RawTextHelpFormatter
from enum import Enum

from config import settings
from src.fetch_blocks_from_chain import fetch_blocks_run_pipeline
from src.load_tvl_snapshot import write_tvl_parquet_table

logging.basicConfig(format="%(asctime)s %(levelname)s %(name)s %(message)s", level=logging.INFO, stream=sys.stdout)


class Pipeline(Enum):
    FETCH_BLOCKS = "fetch_blocks"            # Fetch the blocks numbers and timestamps from the Blockchain.
    LOAD_TVL_SNAPSHOT = "load_tvl_snapshot"  # Load the TVL snapshot to Athena and S3.


def get_args() -> Namespace:
    parser = ArgumentParser(
        description="Fetch the blocks from the Blockchain, and save TVL data to a table in Athena and S3.",
        formatter_class=RawTextHelpFormatter
    )
    parser.add_argument(
        "--pipeline",
        type=str,
        required=True,
        help="(Enum) The name of the pipeline to run. The options are:\n"
        f"1. {Pipeline.FETCH_BLOCKS.value}\n"
        f"2. {Pipeline.LOAD_TVL_SNAPSHOT.value}"
    )

    parser.add_argument(
        "--protocol",
        type=str,
        required=True,
        help="The name of the protocol."
    )
    return parser.parse_args()


def main():
    logging.info("Starting the pipeline.")
    args = get_args()

    if args.pipeline == Pipeline.FETCH_BLOCKS.value:
        rpc_url = settings.RPC_URL

        logging.info(f"Fetching blocks from 'Linea' chain and protocol: '{args.protocol}'")
        fetch_blocks_run_pipeline(
            protocol_name=args.protocol,
            rpc_url=rpc_url
        )
        logging.info("Blocks fetched successfully.")

    elif args.pipeline == Pipeline.LOAD_TVL_SNAPSHOT.value:
        logging.info("Loading TVL snapshot.")
        data = pd.read_parquet(f"{settings.CHAIN_NAME}_{args.protocol}_tvl_snapshot.parquet")
        write_tvl_parquet_table(
            protocol_table_name=args.athena_table,
            chain_database_name=args.athena_database,
            data=data,
            partition_column="date",
            mode_write="append",
        )
        logging.info("TVL snapshot loaded successfully.")


if __name__ == "__main__":
    main()
