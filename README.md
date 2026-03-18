<!-- SPDX-License-Identifier: MIT -->
# Vault 2FA (Firefox Add-on)

一个 **Firefox 用的本地优先 TOTP/HOTP 认证器插件**，支持扫码导入、加密存储与可选云端同步。  
A **local-first TOTP/HOTP authenticator add-on for Firefox** with QR import, encrypted local storage, and optional cloud sync.

## 功能特性 / Features

- 手动添加验证码账户（TOTP/HOTP）  
  Add accounts manually (TOTP/HOTP)
- 扫描二维码添加账户（`otpauth://`）  
  Add accounts by scanning QR codes (`otpauth://`)
- 本地存储可开启加密（口令解锁）  
  Optional encrypted local storage (passphrase unlock)
- 支持通过 Firefox Sync 按会话 ID 上传备份到云端  
  Upload backups to the cloud via Firefox Sync with a session ID
- 可手动从云端下载并覆盖本地数据（有确认提示）  
  Manually download cloud data and overwrite local data (with confirmation)
- 支持导入/导出 `otpauth://` URI  
  Import/export `otpauth://` URIs

## 安装与使用 / Install & Use

### 从AMO安装（发行版） / Install from AMO (release)
[![Download button](firefox-addon.png)](https://addons.mozilla.org/en-US/firefox/addon/vault2fa)

### 从仓库安装（开发版） / User install (development)
1. 打开 Firefox，访问 `about:debugging#/runtime/this-firefox`  
   Open Firefox and go to `about:debugging#/runtime/this-firefox`
2. 点击 **Load Temporary Add-on...**  
   Click **Load Temporary Add-on...**
3. 选择本仓库中的 `manifest.json`  
   Select `manifest.json` from this repository

### 快速上手 / Quick start
1. 点击插件图标，选择 **Add Account**  
   Click the add-on icon and choose **Add Account**
2. 通过 **Manual** 或 **Scan QR** 添加账户  
   Add an account via **Manual** or **Scan QR**
3. 在 **Sync & Security** 中可启用：  
   In **Sync & Security**, you can enable:
   - Firefox Sync 上传 / Firefox Sync upload
   - 本地加密与锁定 / Local encryption and vault lock

## 安全提示 / Security Notes

- 请妥善保管导出的 URI、同步会话 ID 和加密口令。  
  Keep exported URIs, sync session IDs, and vault passphrases secure.
- 丢失口令可能导致无法解密本地数据。  
  Losing your passphrase may make local data unrecoverable.

## 项目结构 / Project Structure

- `manifest.json`: 扩展配置 / Extension manifest
- `popup.html`, `popup.js`, `popup.css`: 主弹窗界面与逻辑 / Main popup UI and logic
- `qr.html`, `qr.js`, `qr.css`: 二维码扫描页面 / QR scanning page
- `background.js`: 后台逻辑 / Background logic
