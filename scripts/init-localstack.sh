#!/bin/bash
set -e

echo "Initializing LocalStack resources..."

awslocal sqs create-queue --queue-name reserve_stock
awslocal sqs create-queue --queue-name release_stock
awslocal sqs create-queue --queue-name process_payment

echo "LocalStack queues created successfully."
