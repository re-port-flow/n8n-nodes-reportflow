# PRJ-3-2351 / PRJ-3-2745: n8n本体とAlpine 3.22を維持し、同じ24系の修正済みNodeだけを取得する。
FROM node:24.22.3-alpine3.23@sha256:3946fb783fdce8a2812136ea694bc95c698c4f4096f3fd18568dc27a8ac389dc AS node-patch

FROM n8nio/n8n:1.123.47

USER root

# /usr/local/bin/nodeはn8nの既存Node実体へのリンク。COPYで実体を置換し旧バイナリを残さない。
COPY --from=node-patch /usr/local/bin/node /usr/local/bin/node
ENV NODE_VERSION=24.22.3
RUN node -e "if (process.version !== 'v24.22.3') process.exit(1)"

RUN mkdir -p /opt/custom-nodes/n8n-nodes-reportflow/node_modules

COPY --chown=node:node dist/ /opt/custom-nodes/n8n-nodes-reportflow/dist/
COPY --chown=node:node package.json /opt/custom-nodes/n8n-nodes-reportflow/

# n8n-workflow を n8n 内部 node_modules からシンボリックリンク
# cp -rP でエントリポイントスクリプトが EFS へコピーする際にリンクを保持する
RUN ln -sf /usr/local/lib/node_modules/n8n/node_modules/n8n-workflow \
      /opt/custom-nodes/n8n-nodes-reportflow/node_modules/n8n-workflow && \
    chown -R node:node /opt/custom-nodes

COPY --chmod=755 docker-entrypoint-custom.sh /usr/local/bin/docker-entrypoint-custom.sh

USER node

ENTRYPOINT ["tini", "--", "/usr/local/bin/docker-entrypoint-custom.sh"]
