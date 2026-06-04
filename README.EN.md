<!-- SPDX-License-Identifier: MIT -->
<br />
<p align="center">
    <img src="icons/icon128.png" alt="Logo" width="128" height="128">
  <h2 align="center" style="font-weight: 800">Vault2FA</h2>

  <p align="center">
    A secure and simple TOTP/HOTP authenticator add-on for Firefox
  </br>
  <a href="https://github.com/DrJason33564/Vault2FA/blob/main/README.md" target="blank"><strong>🇨🇳 简体中文</strong></a>&nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="https://github.com/DrJason33564/Vault2FA/blob/main/README.EN.md" target="blank"><strong>🇺🇸 English</strong></a>

### Features

- Add accounts manually (TOTP/HOTP)
- Add accounts by scanning QR codes (`otpauth://`)
- Optional encrypted local storage (passphrase unlock)
- Upload backups to the cloud via Firefox Sync with a session ID
- Manually download cloud data and overwrite local data (with confirmation)
- Import/export account data via `otpauth://` URIs, json files or QR codes
- Reorder accounts by dragging them  
- Support importing account from Google Authenticator and Microsoft Authenticator
- Recognizes and automatically fills in 2fa input fields based on custom URL matching rules
- Right-click to scan QR code images in web pages
- Full-support for mobile devices

### Install & Use

#### Install from AMO (release)
[![Download button](firefox-addon.png)](https://addons.mozilla.org/en-US/firefox/addon/vault2fa)

#### Install from repository (development)
1. Open Firefox and go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select `manifest.json` from this repository

#### Quick start
1. Click the add-on icon and choose **Add Account**
2. Add an account via **Manual** or **Scan QR**
3. In **Setting**, you have:
   - Firefox Sync upload
   - Local encryption and vault lock
   - Permission Setting
   - Debug mode setting and log downloading
  
### Migration

#### 1.Migrating from Vault2FA
Vault2FA supports exporting standard `otpauth://` URIs, which almost all 2FA authenticators support  

#### 2.Migrating from Google Authenticator to Vault2FA
Google Authenticator uses `otpauth-migration://` URIs with a Base64-encoded Protobuf structure, and Vault2FA supports parsing these links. When a single `otpauth-migration://` URI contains multiple accounts, Vault2FA can also recognize and load them correctly. However, Google Authenticator does not specify the period (the validity duration of a single code) for TOTP codes in the exported link; Vault2FA will import them with a default period of 30 seconds  

#### 3.Migrating from Microsoft Authenticator to Vault2FA
Exporting account data from Microsoft Authenticator is a bit more troublesome. Since the app itself doesn't support exporting, we need to extract the data from its database file using some tools  
**Requirement: Android; Can access `/data/data` directory (usually means with root permission)**  
1. With Microsoft Authenticator installed, navigate to `/data/data/com.azure.authenticator/databases`
2. Copy `PhoneFactor`, `PhoneFactor.wal`, `PhoneFactor-shm` to your PC. If the latter two don't exist, only copy `PhoneFactor`
3. Open [DrJason33564/Microsoft-Authenticator-Export](https://github.com/DrJason33564/Microsoft-Authenticator-Export). If your PC runs Windows x86-64-bit, download the latest `Microsoft-Authenticator-Export.zip` file from the [Release page](https://github.com/DrJason33564/Microsoft-Authenticator-Export/releases) and extract it; if your PC runs a different operating system, please ensure you have a Python environment set up, and download `dump.py` from the repository
4. Put `PhoneFactor` and its related files in the directory `dump.py` is in
5. If using `Microsoft-Authenticator-Export.zip`, execute `dump.bat` ; if using local Python environment, run `python dump.py`
6. If executed successfully, `output_[timestamp].json` will appear in the current directory. Open it with a text editor. `otpauthstr` string is the standard `otpauth://` URI we need, just import it in Vault2FA

### Security Notes

- Keep exported URIs, sync session IDs, and vault passphrases secure  
- Losing your passphrase will result in **unrecoverable local data**  
- It is strongly recommended to keep a local backup of your vault since Firefox Sync is not designed for syncing secrets. Cloud sync
  therefore may have potential bugs

### Permission Declaration  
1. Vault2FA needs "Access your data for all websites" permission to auto fill in input fields in webpages. You can disable this feature in Vault2FA's setting.
2. Vault2FA will add an option to your right-click menu to scan in-page QR code images. You can disable this feature in Vault2FA's setting.

### Screenshots
![IMG_20260318_215605.jpg](images/IMG_20260318_215605.jpg)
![IMG_20260318_221245.jpg](images/IMG_20260318_221245.jpg)
![IMG_20260318_221444.jpg](images/IMG_20260318_221444.jpg)
![IMG_20260318_221847.jpg](images/IMG_20260318_221847.jpg)
![IMG_20260328_224826.jpg](images/IMG_20260328_224826.jpg)

### Project Structure

- `manifest.json`: Extension manifest
- `popup/`: Main popup UI and logic
- `qr/`: QR scanning page
- `background.js`: Background logic
- `autofill/`: Autofill pop-up
- `json-import/`: Import account via json file page
- `migration/`: Decode third-party origins
- `locales/`: Localization files
- `third-party/`: Third-party library

### Acknowledgements

This repository uses code from the following open-source repositories

- [hectorm/otpauth](https://github.com/hectorm/otpauth)
- [cozmo/jsQR](https://github.com/cozmo/jsQR)
- [davidshimjs/qrcodejs](https://github.com/davidshimjs/qrcodejs)
