#!/usr/bin/env sh
# 确保脚本抛出遇到的错误
set -e
npm cache verify
yarn
yarn build # 生成静态文件

echo "build successful"

cd docs/.vuepress/dist # 进入生成的文件夹

echo 'engineering.qdzhou.cn' > CNAME
# deploy to github
if [ -z "$GITHUB_TOKEN" ]; then
  msg='deploy'
  githubUrl=git@github.com:duangdong9/engineering.git
else
  msg='来自github action的自动部署'
  githubUrl=https://duangdong9:${GITHUB_TOKEN}@github.com/duangdong9/engineering.git
  git config --global user.name "zhouqd"
  git config --global user.email "zhouqd1997@163.com"
fi
git init
git add -A
git commit -m "${msg}"
git push -f $githubUrl master:gh-pages # 推送到github

echo "push github successful"

# deploy to coding
# echo 'code.qdzhou.cn' > CNAME  # 自定义域名
# if [ -z "$CODING_TOKEN" ]; then  # -z 字符串 长度为0则为true；$CODING_TOKEN来自于github仓库`Settings/Secrets`设置的私密环境变量
#   codingUrl=git@e.coding.net:serverless-100008396491/engineering/engineering.git
# else
#   codingUrl=https://mMFjLAdigb:${CODING_TOKEN}@e.coding.net/serverless-100008396491/engineering/engineering.git
# fi
# git add -A
# git commit -m "${msg}"
# git push -f $codingUrl master # 推送到coding
# echo "push coding successful"

cd -
rm -rf docs/.vuepress/dist

echo "delete successful"
