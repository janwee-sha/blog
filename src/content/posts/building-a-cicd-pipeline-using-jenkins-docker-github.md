---
title: "使用 Jenkins、Docker 和 GitHub 搭建一个 CI/CD 管道"
published: 2024-01-28
updated: 2026-03-17
description: "CI/CD 的全称是持续集成/持续交付（Continuous Integration and Continuous Delivery），是一种通过自动化过程加速软件交付的实践。CI/CD 管道是实施 CI/CD 的工作流程。"
image: ""
tags: ["CI/CD 管道", "Docker", "Jenkins"]
category: "DevOps"
draft: false
lang: "zh_CN"
---
> 道虽迩，不行不至；事虽小，不为不成。
>
> ——《荀子·修身》

## 1. 什么是 CI/CD

CI/CD 的全称是持续集成/持续交付（Continuous Integration and Continuous Delivery），是一种通过自动化过程加速软件交付的实践。CI/CD 管道是实施 CI/CD 的工作流程。

下文将使用 GitHub 管理源代码，通过 Jenkins Pipeline 构建应用，再使用 Docker 构建镜像并将应用部署到 Linux 主机。

本文省略 Docker 的安装过程，可以参考 [Docker 官方文档](https://docs.docker.com/engine/install/) 安装 Docker Engine 和 Docker Compose。

## 2. 准备 Jenkins 运行环境

Jenkins 官方镜像没有预装 Maven 和 Docker CLI。为了让 Pipeline 能够执行构建与镜像命令，先创建一个用于本地演示的 Jenkins 镜像。

创建 `jenkins-runtime` 目录，并在目录中创建 `Dockerfile.jenkins`：

```dockerfile title="Dockerfile.jenkins"
FROM jenkins/jenkins:lts-jdk21

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends docker.io maven \
    && rm -rf /var/lib/apt/lists/*

USER jenkins
```

在同一目录创建 `compose.yaml`：

```yaml title="compose.yaml"
services:
  jenkins:
    build:
      context: .
      dockerfile: Dockerfile.jenkins
    container_name: jenkins
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - jenkins_home:/var/jenkins_home
      - /var/run/docker.sock:/var/run/docker.sock
    group_add:
      - "${DOCKER_GID}"

volumes:
  jenkins_home:
```

读取宿主机上 Docker socket 的组 ID，将其写入 Compose 使用的 `.env` 文件，然后启动 Jenkins：

```bash
printf 'DOCKER_GID=%s\n' "$(stat -c '%g' /var/run/docker.sock)" > .env
docker compose up -d --build
```

> [!WARNING]
> 将 `/var/run/docker.sock` 挂载到 Jenkins 容器后，Pipeline 可以控制宿主机的 Docker daemon，相当于获得宿主机上的高权限。本方案仅适用于隔离的学习或测试环境；生产环境应使用权限受控的专用 Jenkins Agent，并限制凭据和网络访问。

检查容器状态，并确认 Jenkins 容器可以调用 Maven 和宿主机的 Docker daemon：

```bash
docker compose ps
docker exec jenkins mvn --version
docker exec jenkins docker version
```

## 3. 初始化 Jenkins

浏览器访问 `http://<your_ip>:8080`，进入 Jenkins 管理界面。

![Jenkins 解锁页面](/uploads/2024/01/LoginToJenkins.png)

执行以下命令读取初始管理员密码，然后用它解锁 Jenkins：

```bash
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

按照向导安装推荐插件并创建管理员用户。本文使用 Pipeline、Git 和 GitHub 插件；如果没有随推荐插件安装，请在“Manage Jenkins > Plugins”中补充安装。

## 4. 准备示例应用

本文使用 [simple-web-app](https://github.com/janwee-sha/simple-web-app) 作为示例。这是一个使用 Maven 构建的 Java Web 应用，访问后会返回服务器时间。

```bash
git clone https://github.com/janwee-sha/simple-web-app.git
cd simple-web-app
```

### 4.1. 生成可执行 JAR

在 `pom.xml` 的 `<build><plugins>` 中加入 Spring Boot Maven Plugin，使 `mvn package` 生成包含运行时依赖的可执行 JAR：

```xml
<plugin>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-maven-plugin</artifactId>
</plugin>
```

示例项目已经通过 `<finalName>simple-web-app</finalName>` 将构建产物命名为 `target/simple-web-app.jar`。

### 4.2. 创建应用镜像

将仓库根目录下的 `Dockerfile` 修改为：

```dockerfile title="Dockerfile"
FROM eclipse-temurin:21-jre

WORKDIR /app

COPY target/simple-web-app.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
```

宿主机的 7100 端口将在部署阶段映射到容器内的 8080 端口，因此不会与 Jenkins 使用的 8080 端口冲突。

### 4.3. 编写 Jenkinsfile

在仓库根目录创建 `Jenkinsfile`：

```groovy title="Jenkinsfile"
pipeline {
    agent any

    environment {
        APP_NAME = "simple-web-app"
        HOST_PORT = "7100"
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: "20"))
        disableConcurrentBuilds()
        skipDefaultCheckout(true)
        timestamps()
    }

    triggers {
        githubPush()
    }

    stages {
        stage("Checkout") {
            steps {
                checkout scm
            }
        }

        stage("Build") {
            steps {
                sh "mvn -B clean package"
            }
        }

        stage("Build image") {
            steps {
                sh 'docker build --tag "$APP_NAME:$BUILD_NUMBER" .'
            }
        }

        stage("Deploy") {
            steps {
                sh '''
                    docker rm -f "$APP_NAME" 2>/dev/null || true
                    docker run -d \
                        --name "$APP_NAME" \
                        --restart unless-stopped \
                        -p "$HOST_PORT:8080" \
                        "$APP_NAME:$BUILD_NUMBER"
                '''
            }
        }

        stage("Verify") {
            steps {
                sh '''
                    test "$(docker inspect -f '{{.State.Running}}' "$APP_NAME")" = "true"
                '''
            }
        }
    }
}
```

这个 Pipeline 会依次检出代码、执行 Maven 构建、构建 Docker 镜像、替换旧容器并检查新容器是否正在运行。将 `pom.xml`、`Dockerfile` 和 `Jenkinsfile` 一起提交到 GitHub。

## 5. 创建 Pipeline 任务

在 Jenkins 中选择“Dashboard > New Item”，输入任务名称并选择“Pipeline”。

在任务配置的“Pipeline”区域进行以下设置：

1. “Definition”选择“Pipeline script from SCM”。
2. “SCM”选择“Git”。
3. “Repository URL”填写 `https://github.com/janwee-sha/simple-web-app.git`。
4. “Branch Specifier”填写 `*/main`。
5. “Script Path”填写 `Jenkinsfile`。

示例仓库是公开仓库，因此不需要认证凭据。使用私有仓库时，应在 Jenkins Credentials 中保存访问凭据，并在任务配置中选择对应的凭据；不要将令牌或私钥写入 `Jenkinsfile`。

保存任务后，先点击“Build Now”执行一次，使 Jenkins 读取并注册 `Jenkinsfile` 中的触发器。

## 6. 配置 GitHub Webhook

要在代码推送后自动触发 Pipeline，需要确保 GitHub 可以通过 HTTPS 访问 Jenkins，然后在 GitHub 仓库的“Settings > Webhooks”中添加 Webhook：

1. “Payload URL”填写 `https://<JENKINS_HOST>/github-webhook/`。
2. “Content type”选择 `application/json`。
3. 事件选择“Just the push event”。

本地 Jenkins 无法被 GitHub 访问时，可以暂时使用“Build Now”手动触发；不要为了接收 Webhook 而把未配置身份验证和 HTTPS 的 Jenkins 直接暴露到公网。

## 7. 部署并验证应用

Pipeline 成功后，浏览器访问 `http://<your_ip>:7100`。页面返回服务器时间，说明 Maven 构建、Docker 镜像构建和容器部署均已完成。

后续向 `main` 分支推送提交时，GitHub Webhook 会通知 Jenkins，Jenkins 再按照仓库中的 `Jenkinsfile` 重新执行整个 Pipeline。

## 引用与资源

1. simple-web-app：[https://github.com/janwee-sha/simple-web-app](https://github.com/janwee-sha/simple-web-app)
2. Jenkins 官方 Docker 镜像文档：[https://github.com/jenkinsci/docker/blob/master/README.md](https://github.com/jenkinsci/docker/blob/master/README.md)
3. Jenkins Maven 教程：[https://www.jenkins.io/doc/tutorials/build-a-java-app-with-maven/](https://www.jenkins.io/doc/tutorials/build-a-java-app-with-maven/)
4. Docker Engine 安装指引：[https://docs.docker.com/engine/install/](https://docs.docker.com/engine/install/)
5. Docker daemon socket 安全指引：[https://docs.docker.com/engine/security/protect-access/](https://docs.docker.com/engine/security/protect-access/)
