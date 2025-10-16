#!/usr/bin/env bash

set -e

(
  cd out
  git init
  git checkout -b gh-pages
  git add .
  git commit -m "publish"
  git remote add origin 
  git push --force origin main
)
