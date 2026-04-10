<!-- SPDX-License-Identifier: MIT -->
<br />
<p align="center">
    <img src="icons/icon128.png" alt="Logo" width="128" height="128">
  <h2 align="center" style="font-weight: 800">Vault2FA</h2>

  <p align="center">
    一个为Firefox开发的、简洁安全的TOTP/HOTP认证器插件
    <br />
    A secure and simple TOTP/HOTP authenticator add-on for Firefox

### 功能特性 / Features

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
- 支持通过 `otpauth://` URI或json文件形式导入/导出账号数据  
  Import/export account data via `otpauth://` URIs or json files  
- 支持从Google Authenticator以及微软Authenticator导入数据  
  Support importing account from Google Authenticator and Microsoft Authenticator
- 支持根据自定义的网址匹配规则识别验证码输入框并自动填充  
  Recognizes and automatically fills in 2fa input fields based on custom URL matching rules
- 支持通过右键菜单直接扫描网页内的二维码图片  
  Right-click to scan QR code images in web pages
- 完全支持移动端  
  Full-support for mobile devices

### 安装与使用 / Install & Use

#### 从AMO安装（发行版） / Install from AMO (release)
[![Download button](firefox-addon.png)](https://addons.mozilla.org/en-US/firefox/addon/vault2fa)

#### 从仓库安装（开发版） / Install from repository (development)
1. 打开 Firefox，访问 `about:debugging#/runtime/this-firefox`  
   Open Firefox and go to `about:debugging#/runtime/this-firefox`
2. 点击 **临时加载附加组件...**  
   Click **Load Temporary Add-on...**
3. 选择本仓库中的 `manifest.json`  
   Select `manifest.json` from this repository

#### 快速上手 / Quick start
1. 点击插件图标，选择 **添加账号**  
   Click the add-on icon and choose **Add Account**
2. 通过 **手动录入** 或 **扫描二维码** 添加账户  
   Add an account via **Manual** or **Scan QR**
3. 在 **设置** 中有：  
   In **Setting**, you have:
   - Firefox Sync 上传 / Firefox Sync upload
   - 本地加密与锁定 / Local encryption and vault lock
   - 权限设置 / Permission Setting
   - Debug模式开关和日志下载 / Debug mode setting and log downloading
  
### 迁移 / Migration

#### 1.从 Vault2FA 迁移 / Migrating from Vault2FA
Vault2FA支持导出标准的`otpauth://`URIs，几乎所有的二步验证器都支持这种链接  
Vault2FA supports exporting standard `otpauth://` URIs, which almost all 2FA authenticators support  

#### 2.从 Google Authenticator 迁移到 Vault2FA / Migrating from Google Authenticator to Vault2FA
Google Authenticator使用Base64编码后protobuf结构的`otpauth-migration://`URI，Vault2FA支持解析此类链接。当单个`otpauth-migration://`URI包含多个账号时，Vault2FA也可识别并正确加载。然而，Google Authenticator并未在导出链接中给出TOTP验证码的period（单个验证码有效时长），Vault2FA会默认以30秒为period导入  
Google Authenticator uses `otpauth-migration://` URIs with a Base64-encoded Protobuf structure, and Vault2FA supports parsing these links. When a single `otpauth-migration://` URI contains multiple accounts, Vault2FA can also recognize and load them correctly. However, Google Authenticator does not specify the period (the validity duration of a single code) for TOTP codes in the exported link; Vault2FA will import them with a default period of 30 seconds  

#### 3.从 Microsoft Authenticator 迁移到 Vault2FA / Migrating from Microsoft Authenticator to Vault2FA
从Microsoft Authenticator导出账户数据要麻烦些。因为其自身不支持导出，我们需要使用工具从其数据库文件中提取  
Exporting account data from Microsoft Authenticator is a bit more troublesome. Since the app itself doesn't support exporting, we need to extract the data from its database file using some tools  
**导出要求：安卓系统；能够访问`/data/data`目录（通常需要root权限）**  
**Requirement: Android; Can access `/data/data` directory (usually means with root permission)**  
1. 在安装了Microsoft Authenticator的手机上打开`/data/data/com.azure.authenticator/databases`目录  
   With Microsoft Authenticator installed, navigate to `/data/data/com.azure.authenticator/databases`
2. 将 `PhoneFactor`, `PhoneFactor.wal`, `PhoneFactor-shm` 三个文件复制至电脑上。若后二者不存在，仅复制`PhoneFactor`即可  
   Copy `PhoneFactor`, `PhoneFactor.wal`, `PhoneFactor-shm` to your PC. If the latter two don't exist, only copy `PhoneFactor`
3. 打开 [DrJason33564/Microsoft-Authenticator-Export](https://github.com/DrJason33564/Microsoft-Authenticator-Export)。若您的PC是Windows x86-64bit系统，从[Release页](https://github.com/DrJason33564/Microsoft-Authenticator-Export/releases)下载最新的`Microsoft-Authenticator-Export.zip`文件并解压即可；若您的PC是其他系统，请自备Python环境，并从仓库下载`dump.py`  
   Open [DrJason33564/Microsoft-Authenticator-Export](https://github.com/DrJason33564/Microsoft-Authenticator-Export). If your PC runs Windows x86-64-bit, download the latest `Microsoft-Authenticator-Export.zip` file from the [Release page](https://github.com/DrJason33564/Microsoft-Authenticator-Export/releases) and extract it; if your PC runs a different operating system, please ensure you have a Python environment set up, and download `dump.py` from the repository
4. 将`PhoneFactor`相关文件放在`dump.py`同级目录中  
   Put `PhoneFactor` and its related files in the directory `dump.py` is in
5. 使用`Microsoft-Authenticator-Export.zip`的，运行`dump.bat`；自备python环境的，执行`python dump.py`  
   If using `Microsoft-Authenticator-Export.zip`, execute `dump.bat` ; if using local Python environment, run `python dump.py`
6. 运行成功后，`output_[时间戳].json`文件将会在当前目录下生成。使用文本编辑器打开它，`otpauthstr`字段即是标准`otpauth://`URI链接，在Vault2FA中导入即可  
   If executed successfully, `output_[timestamp].json` will appear in the current directory. Open it with a text editor. `otpauthstr` string is the standard `otpauth://` URI we need, just import it in Vault2FA

### 安全提示 / Security Notes

- 请妥善保管导出的 URI、同步会话 ID 和加密口令  
  Keep exported URIs, sync session IDs, and vault passphrases secure
- 丢失口令可能导致无法解密本地数据  
  Losing your passphrase may make local data unrecoverable
- 强烈建议在本地保存一份密码库的备份，因为Firefox Sync并非为同步秘钥设计，云同步可能存在潜在问题  
  It is strongly recommended to keep a local backup of your vault since Firefox Sync is not designed for syncing secrets. Cloud sync
  therefore may have potential bugs

### 截图 / Screenshots
![IMG_20260318_215605.jpg](images/IMG_20260318_215605.jpg)
![IMG_20260318_221245.jpg](images/IMG_20260318_221245.jpg)
![IMG_20260318_221444.jpg](images/IMG_20260318_221444.jpg)
![IMG_20260318_221847.jpg](images/IMG_20260318_221847.jpg)
![IMG_20260328_224826.jpg](images/IMG_20260328_224826.jpg)

### 项目结构 / Project Structure

- `manifest.json`: 扩展配置 / Extension manifest
- `popup/popup.html`, `popup/popup.js`, `popup/popup.css`: 主弹窗界面与逻辑 / Main popup UI and logic
- `qr/`: 二维码扫描页面 / QR scanning page
- `background.js`: 后台逻辑 / Background logic
- `autofill/`: 自动填充弹窗 / Autofill pop-up
- `json-import/`: 通过JSON文件导入账号页面 / Import account via json file page
- `migration/`: 对第三方来源进行解码 / Decode third-party origins
- `locales/`: 本地化文件 / Localization files
- `third-party/`: 第三方库 / Third-party library

### 致谢 / Acknowledgements

本项目使用了以下开源仓库的代码  
This repository uses code from the following open-source repositories

- [hectorm/otpauth](https://github.com/hectorm/otpauth)
- [cozmo/jsQR](https://github.com/cozmo/jsQR)
