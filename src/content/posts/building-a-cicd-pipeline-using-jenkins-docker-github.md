---
title: "使用Jenkins、Docker和GitHub搭建一个CI/CD管道"
published: 2024-01-28
updated: 2026-03-17
description: "CI/CD的全称是持续集成/持续交付（Continuous Integration and Continuous Delivery），是一种软件开发实践，目标是通过自动化的过程来加速软件交付。CI/CD管道是实施CI/CD的工作流程。"
image: ""
tags: ["CI/CD管道", "Docker", "Jenkins"]
category: "DevOps"
draft: false
lang: "zh_CN"
---
> 道虽迩，不行不至；事虽小，不为不成
>
> — ——《荀子·修身》

## 1\. 什么是CI/CD

CI/CD的全称是持续集成/持续交付（Continuous Integration and Continuous Delivery），是一种软件开发实践，目标是通过自动化的过程来加速软件交付。CI/CD管道是实施CI/CD的工作流程。

下文我将使用GitHub作为源代码管理仓库，构建引擎选择Jenkins，使用Docker作为部署引擎在Linux主机上构建一个CI/CD管道。

省略了安装Docker的部分，可以参考 [Docker的官方文档](https://docs.docker.com/engine/install/) 安装Docker容器引擎。

## 2.安装Jenkins服务

创建jenkins目录和`executors.groovy`配置文件，在`executors.groovy`中指定Jenkins实例的执行器数量：

```bash
mkdir jenkins && cd jenkins
echo "import jenkins.model.*
Jenkins.instance.setNumExecutors(5)" > executors.groovy
```

运行 `docker run` 指令安装Jenkins：

```bash
docker run -d --name jenkins --restart=on-failure \
	-p 8080:8080 -p 50000:50000 \
	--user $(id -u):$(id -g) \
	-v /etc/group:/etc/group:ro \
	-v /etc/passwd:/etc/passwd:ro \
	-v /etc/shadow:/etc/shadow:ro \
	-v `pwd`/data:/var/jenkins_home:rw \
	-v /var/run/docker.sock:/var/run/docker.sock \
	-v /usr/bin/docker:/usr/bin/docker \
	-v ./executors.groovy:/usr/share/jenkins/ref/init.groovy.d/executors.groovy \
	jenkins/jenkins:lts-jdk17
```

因为我们需要在 Jenkins 容器内部运行 Docker 命令，所以将宿主机的 `docker.sock` 文件和 `/usr/bin/docker` 挂载到 Jenkins 容器内部，同时通过`--user`指令指定容器运行时的用户为Docker引擎所在的宿主机的用户，相应地还需要将宿主机地用户和组文件挂载到Jenkins容器内部。

`-v ./executors.groovy:/usr/share/jenkins/ref/init.groovy.d/executors.groovy` 挂载选项将前一个步骤创建的 groovy 脚本挂载到Jenkins容器内部。

检查Jenkins容器的状态：

```bash
$ docker ps -a
CONTAINER ID  IMAGE                      ...  STATUS ...
c3980e70e14f  jenkins/jenkins:lts-jdk17  ...  Up 5 minutes ...
```

`Status` 栏表明容器启动成功。

检查Jenkins容器内的环境是否能使用宿主机的Docker引擎：

```bash
docker exec -it jenkins bash -c "docker version"
```

输出Docker版本信息则表明可以正常使用。

## 3.登录并创建一个用户和Jenkins实例

### 3.1.登录Jenkins

浏览器访问 `http://<your_ip>:8080` 进入Jenkins的管理客户端。

![LoginToJenkins](/uploads/2024/01/LoginToJenkins.png)

复制 {Jenkins Home}/secrets/initialAdminPassword 中的密码以root身份登录Jenkins。

### 3.2.创建管理员用户并配置实例

按照向导填写用户名、密码、邮箱创建管理员用户，实例配置使用默认配置。

## 4.创建管道

### 4.1.安装Git和Maven Integration插件

选择“Manage Jenkins”-“Plugins”，搜索下载Git和Maven Integration插件，安装完成后重启Jenkins使插件生效。

### 4.2.使用SSH协议保护远程Shell脚本拉取GitHub仓库的信息安全

在Jenkins容器内的bash终端中使用ssh-keygen生成公钥私钥对：

```bash
ssh-keygen
```

进入密钥目录并查看公钥文件，复制里面的公钥：

```bash
cat root/.ssh/id_rsa.pub
```

在你的GitHub账户下的“SSH and GPG keys”菜单下点击“New SSH key”，填写公钥并保存。

最后在“Dashboard > Manage Jenkins > Credentials”菜单下，点击“Add Credentials”，选择凭据类型为“SSH name with private key”，并填写上面生成的凭据用户名和密钥。

### 4.3.创建一个任务

在“Dashboard”下，点击“Create a Job”创建一个任务，类型选择构建一个Maven项目。

![CreateAJob](/uploads/2024/01/CreateAJob.png)

### 4.4.全局工具配置

在“Dashboard > Manage Jenkins > Tools”菜单下配置JDK及Maven环境。

告知Jenkins如何构造simple-web-app应用的Docker镜像。

新建Dockerfile文件，构建应用程序的镜像，比如这里创建一个使用Maven创建的名为Simple Web App的Java Web程序，这是一个响应系统时间的Web程序，代码可以在[我的GitHub仓库](https://github.com/janwee-sha/simple-web-app)上拉取：

```text
FROM openjdk:20-slim

MAINTAINER key "your email address"

ADD target/simple-web-app-1.0-SNAPSHOT.jar simple-web-app-1.0-SNAPSHOT.jar

EXPOSE 8080

ENTRYPOINT ["java","-jar","/simple-web-app-1.0-SNAPSHOT.jar"]
```

拷贝到Jenkins容器内部的任务工作空间：

```bash
docker cp Dockerfile jenkins:/var/jenkins_home/workspace/{Jenkins任务名称}/
```

### 4.5.创建Jenkins构建和部署任务

点击“新建任务”，输入任务名称，选择“构建一个Maven项目”，在“源码管理”栏选择“Git”，并填写Git仓库地址并指定版本分支，GitHub的认证凭据选择3.3中预先配置的全局凭据。

在“源码管理”中选择“Git”并填写simple-web-app工程的GitHub仓库URL并指定分支。

在“构建触发器”中选择默认的“Build whenever a SNAPSHOT dependency is built”。

在“构建（Build）”中的“Root POM”项输入“pom.xml”，表示simple-web-app根目录下的pom.xml文件；“Goals and options”项填写：

```html
install simple-web-app
```

在"构建后步骤（Post Steps）"中选择“Run only if build succeeds”，点击添加“执行shell”步骤，shell脚本如下：

```bash
cname="simple-web-app"
cid=$(docker ps -a -f "name=${cname}"  --format {{.ID}})
if ["$cid" != ""]; then
	docker stop "$cid"
	docker rm "$cid"
fi

cd "$WORKSPACE"/simple-web-app
docker build -t simple-web-app .

docker rmi $(docker images -q -f dangling=true)

docker run -d --name simple-web-app -p 7100:7100 simple-web-app
```

点击“保存”保存该任务的配置。

## 5\. 部署应用程序

选择创建的任务，点击“立即构建”，等待构建结果，若任务成功，则表示我们的构建和部署流水线成功搭建。

## 引用 & 资源

1.  simple-web-app @ [https://github.com/janwee-sha/simple-web-app](https://github.com/janwee-sha/simple-web-app)
2.  Jenkins 官方Docker镜像文档 @  [https://github.com/jenkinsci/docker/blob/master/README.md](https://github.com/jenkinsci/docker/blob/master/README.md)
3.  使用Maven构建Java程序 @ [https://www.jenkins.io/doc/tutorials/build-a-java-app-with-maven/](https://www.jenkins.io/doc/tutorials/build-a-java-app-with-maven/)
4.  Docker引擎安装指引 @ [https://docs.docker.com/engine/install/](https://docs.docker.com/engine/install/)
