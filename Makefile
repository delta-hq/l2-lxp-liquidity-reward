SHELL := /bin/sh
PROTOCOL ?= 

AWS_REGION = us-east-1
PROJECT_NAME = l2-lxp-liquidity-reward
ENV ?= dev
AWS_ACCOUNT_ID = 522495932155
ECR_URI = ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}

build_docker_image:
	docker build -t ${PROJECT_NAME}-${ENV} -f devops/Dockerfile .

login_ecr_docker_registry:
	aws ecr get-login-password --region ${AWS_REGION} | \
	docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

build_and_push_docker_image:
	docker build -t ${PROJECT_NAME}-${ENV} -f devops/Dockerfile .
	printf "Publishing ${PROJECT_NAME} docker image to ${ENV} ECR repository"
	docker tag ${PROJECT_NAME}:latest ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}:latest
	docker push ${ECR_URI}:latest

# for prod run: (e.g.) ENV=prod PROTOCOL=gravita make run_pipeline
run_pipeline:
	python main.py --pipeline fetch_blocks --protocol ${PROTOCOL} && \
	cd adapters/${PROTOCOL} && npm install && tsc && npm run start && \
	cd - && ENV=prod python main.py --pipeline load_tvl_snapshot --protocol ${PROTOCOL}
