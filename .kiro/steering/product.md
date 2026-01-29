# 产品概述

## 项目简介

Suno API 是一个开源项目，通过 API 调用 Suno.ai 的音乐生成服务，可轻松集成到 GPTs 等 AI 代理中。

## 核心功能

- **音乐生成 API**：完整实现 suno.ai 的音乐创作 API
- **自动保活**：自动保持账户活跃状态
- **验证码自动处理**：使用 2Captcha 服务和 Playwright 自动解决 hCaptcha 挑战
- **OpenAI 兼容**：兼容 OpenAI `/v1/chat/completions` API 格式
- **自定义模式**：支持自定义歌词、音乐风格、标题等
- **AI 代理集成**：适配 GPTs、Coze 等 AI 代理平台的 API Schema

## 技术特点

- 使用付费的 2Captcha 服务自动解决验证码
- 基于 Playwright 和 rebrowser-patches 进行浏览器自动化
- 支持一键部署到 Vercel 和 Docker
- LGPL-3.0 开源许可证，允许自由集成和修改

## 当前版本

- 版本：1.1.0
- 兼容 Suno v5（包含关键修复）
- 默认模型：chirp-crow (v5 - 最新版本)
