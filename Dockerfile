FROM n8nio/n8n:1.82.1

USER root

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
