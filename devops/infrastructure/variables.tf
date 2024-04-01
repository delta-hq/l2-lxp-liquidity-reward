# data "aws_caller_identity" "current" {}

locals {
  env        = terraform.workspace == "default" ? "dev" : terraform.workspace
  project    = "l2-lxp-liquidity-reward"
  team       = "data-engineering"
  account_id = "522495932155"
  region     = "us-east-1"
}

variable "ecr_repo_url" {
  type        = string
  description = "URI of the ECR repository"
  default     = "522495932155.dkr.ecr.us-east-1.amazonaws.com/linea-openblocklabs/l2-lxp-liquidity-reward"
}

variable "ecr_repo_image_tag" {
  type        = string
  description = "Tag of the ECR repository"
  default     = "latest"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "us-east-1"
}
