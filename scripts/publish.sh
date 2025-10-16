#!/usr/bin/env bash

set -e

(
  cd out
  rm -rf .git
  git init
  git checkout -b gh-pages
  git add .
  git commit -m "publish"
  git remote add origin git@github.com:joeskeen/gospel-metacasts.git
  git push --force origin gh-pages
)
