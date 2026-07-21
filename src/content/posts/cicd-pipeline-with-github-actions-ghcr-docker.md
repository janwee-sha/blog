---
title: cicd-pipeline-with-github-actions-ghcr-docker
published: 2026-07-21
description: '使用 GitHub Actions、GHCR、Docker Compose 在 Linux 主机搭建 CI/CD 管道'
image: ''
tags: ["CI/CD 管道", "Docker", "GHCR", "GitHub Actions"]
category: 'DevOps'
draft: true 
lang: 'zh_CN'
---

## 方案

1. PR 阶段：GitHub Actions 执行 mvn verify。
2. 合并到 main：使用 Buildx 构建镜像并推送到 ghcr.io。
3. 部署阶段：通过 SSH 在服务器执行：

    ```bash
    docker compose pull
    docker compose up -d
    ```

4. 运行健康检查；失败时回滚到上一个 commit SHA 对应的镜像。

GitHub Actions 可以直接使用短期 GITHUB_TOKEN 发布 GHCR 镜像；官方也提供构建、标签和推送镜像的标准流程。GitHub 镜像发布文档
(https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)

生产凭据可以放在 GitHub Environment 中，并配置允许部署的分支、人工审批和环境级 Secrets。GitHub Environments 文档
(https://docs.github.com/en/enterprise-cloud@latest/actions/concepts/workflows-and-actions/deployment-environments)