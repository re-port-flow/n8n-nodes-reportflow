#!/bin/sh
set -e

# n8n は ~/.n8n/nodes/node_modules/ を LazyPackageDirectoryLoader でスキャンし
# package.json の name をパッケージ名として使う（例: n8n-nodes-reportflow.reportFlow）
# N8N_CUSTOM_EXTENSIONS の CustomDirectoryLoader は CUSTOM.reportFlow として登録するため使えない
mkdir -p /home/node/.n8n/nodes/node_modules
rm -rf /home/node/.n8n/nodes/node_modules/n8n-nodes-reportflow
cp -rP /opt/custom-nodes/n8n-nodes-reportflow \
    /home/node/.n8n/nodes/node_modules/n8n-nodes-reportflow

exec /docker-entrypoint.sh "$@"
