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

    pipeline = args.pipeline
    protocol = args.protocol

    db_name = f"{settings.CHAIN_NAME}_raw"
    table_name = f"{protocol}_tvl_by_user"
    s3_prefix = f"s3://{settings.CHAIN_NAME}-openblocklabs/raw/{settings.CHAIN_NAME}/{protocol}_tvl_by_user/"

    if pipeline == Pipeline.FETCH_BLOCKS.value:
        rpc_url = settings.RPC_URL

        logging.info(f"Fetching blocks from 'Linea' chain and protocol: '{protocol}'")
        hourly_blocks_to_fetch = fetch_blocks_run_pipeline(db_name=db_name, table_name=table_name, rpc_url=rpc_url)

        hourly_blocks_to_fetch.to_csv(f"./adapters/{protocol}/src/hourly_blocks.csv", index=False, header=True)
        logging.info("Blocks fetched successfully.")

    elif pipeline == Pipeline.LOAD_TVL_SNAPSHOT.value:
        logging.info("Loading TVL snapshot.")
        # read csv and transform data to parquet

        data = pd.read_csv(f"./adapters/{args.protocol}/outputData.csv")
        # data = pd.read_parquet(f"{settings.CHAIN_NAME}_{args.protocol}.parquet")
        write_tvl_parquet_table(
            path=s3_prefix,
            db_name=db_name,
            table_name=table_name,
            data=data,
            partition_column="timestamp",
            mode_write="append",
        )
        logging.info("TVL snapshot loaded successfully.")


if __name__ == "__main__":
    main()
