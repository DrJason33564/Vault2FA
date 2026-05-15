<!-- SPDX-License-Identifier: MIT -->
<br />
<p align="center">
    <img src="icons/icon128.png" alt="Logo" width="128" height="128">
  <h2 align="center" style="font-weight: 800">Vault2FA</h2>

  <p align="center">
    一个为Firefox开发的、简洁安全的TOTP/HOTP认证器插件
  </br>
  <a href="https://github.com/DrJason33564/Vault2FA/blob/main/README.md" target="blank"><strong>🇨🇳 简体中文</strong></a>&nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="https://github.com/DrJason33564/Vault2FA/blob/main/README.EN.md" target="blank"><strong>🇺🇸 English</strong></a>

### 功能特性

- 手动添加验证码账户（TOTP/HOTP）  
- 扫描二维码添加账户（`otpauth://`）  
- 本地存储可开启加密（口令解锁）  
- 支持通过 Firefox Sync 按会话 ID 上传备份到云端  
- 可手动从云端下载并覆盖本地数据（有确认提示）  
- 支持通过 `otpauth://` URI、json文件或二维码形式导入/导出账号数据
- 通过拖动账户卡片以重新排序  
- 支持从Google Authenticator以及微软Authenticator导入数据  
- 支持根据自定义的网址匹配规则识别验证码输入框并自动填充  
- 支持通过右键菜单直接扫描网页内的二维码图片  
- 完全支持移动端  

### 安装与使用

#### 从AMO安装（发行版）
[![Download button](firefox-addon.png)](https://addons.mozilla.org/zh-CN/firefox/addon/vault2fa)

#### 从仓库安装（开发版）
1. 打开 Firefox，访问 `about:debugging#/runtime/this-firefox`  
2. 点击 **临时加载附加组件...**  
3. 选择本仓库中的 `manifest.json`  

#### 快速上手
1. 点击插件图标，选择 **添加账号**  
2. 通过 **手动录入** 或 **扫描二维码** 添加账户  
3. 在 **设置** 中有：  
   - Firefox Sync 上传
   - 本地加密与锁定
   - 权限设置
   - Debug模式开关和日志下载
  
### 迁移

#### 1.从 Vault2FA 迁移
Vault2FA支持导出标准的`otpauth://`URIs，几乎所有的二步验证器都支持这种链接  

#### 2.从 Google Authenticator 迁移到 Vault2FA
Google Authenticator使用Base64编码后protobuf结构的`otpauth-migration://`URI，Vault2FA支持解析此类链接。当单个`otpauth-migration://`URI包含多个账号时，Vault2FA也可识别并正确加载。然而，Google Authenticator并未在导出链接中给出TOTP验证码的period（单个验证码有效时长），Vault2FA会默认以30秒为period导入  

#### 3.从 Microsoft Authenticator 迁移到 Vault2FA
从Microsoft Authenticator导出账户数据要麻烦些。因为其自身不支持导出，我们需要使用工具从其数据库文件中提取  
**导出要求：安卓系统；能够访问`/data/data`目录（通常需要root权限）**  
1. 在安装了Microsoft Authenticator的手机上打开`/data/data/com.azure.authenticator/databases`目录  
2. 将 `PhoneFactor`, `PhoneFactor.wal`, `PhoneFactor-shm` 三个文件复制至电脑上。若后二者不存在，仅复制`PhoneFactor`即可  
3. 打开 [DrJason33564/Microsoft-Authenticator-Export](https://github.com/DrJason33564/Microsoft-Authenticator-Export)。若您的PC是Windows x86-64bit系统，从[Release页](https://github.com/DrJason33564/Microsoft-Authenticator-Export/releases)下载最新的`Microsoft-Authenticator-Export.zip`文件并解压即可；若您的PC是其他系统，请自备Python环境，并从仓库下载`dump.py`  
4. 将`PhoneFactor`相关文件放在`dump.py`同级目录中  
5. 使用`Microsoft-Authenticator-Export.zip`的，运行`dump.bat`；自备python环境的，执行`python dump.py`  
6. 运行成功后，`output_[时间戳].json`文件将会在当前目录下生成。使用文本编辑器打开它，`otpauthstr`字段即是标准`otpauth://`URI链接，在Vault2FA中导入即可  

### 安全提示

- 请妥善保管导出的 URI、同步会话 ID 和加密口令  
- 丢失口令会导致**无法解密本地数据**  
- 强烈建议在本地保存一份密码库的备份，因为Firefox Sync并非为同步秘钥设计，云同步可能存在潜在问题  

### 截图 / Screenshots
![IMG_20260318_215605.jpg](images/IMG_20260318_215605.jpg)
![IMG_20260318_221245.jpg](images/IMG_20260318_221245.jpg)
![IMG_20260318_221444.jpg](images/IMG_20260318_221444.jpg)
![IMG_20260318_221847.jpg](images/IMG_20260318_221847.jpg)
![IMG_20260328_224826.jpg](images/IMG_20260328_224826.jpg)

### 项目结构

- `manifest.json`: 扩展配置
- `popup/`: 主弹窗界面与逻辑
- `qr/`: 二维码扫描页面
- `background.js`: 后台逻辑
- `autofill/`: 自动填充弹窗
- `json-import/`: 通过JSON文件导入账号页面
- `migration/`: 对第三方来源进行解码
- `locales/`: 本地化文件
- `third-party/`: 第三方库

### 致谢

本项目使用了以下开源仓库的代码  

- [hectorm/otpauth](https://github.com/hectorm/otpauth)
- [cozmo/jsQR](https://github.com/cozmo/jsQR)
- [davidshimjs/qrcodejs](https://github.com/davidshimjs/qrcodejs)
