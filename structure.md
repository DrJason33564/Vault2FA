# Vault2FA 源码结构与业务流程说明

> 本文只描述当前代码中已经实现的逻辑，不描述未实现或计划中的逻辑。

## 一、按文件夹 / 文件划分的业务说明

### 1. `popup/`

#### `popup/popup.js`

主弹窗页面脚本，负责用户在扩展 popup 中看到和操作的大部分 UI。

主要职责：

- **运行时状态维护**
  - 维护账号列表、当前可见账号、活动添加 tab、同步设置、vault 状态、自动锁设置、debug 状态、功能开关、语言、主题、编辑账号 id、验证码缓存、账号排序状态和拖拽状态。
  - 账号顺序使用 `accountSettings.sequence` 单独保存到 `browser.storage.local`。

- **本地化与主题**
  - 通过 `window.Vault2FALocales.getAvailableLanguages()` 读取语言列表信息。
  - 通过 `window.Vault2FALocales.getSection('popup', locale)` 加载当前语言的 popup section。
  - 内置 `POPUP_FALLBACK` 作为英文 failsafe；正常情况下仍优先使用 `.lang` 文件中的文案。
  - 支持 `light`、`dark`、`auto` 三种主题模式，并保存到 `browser.storage.local.uiTheme`。

- **账号列表展示**
  - 从 background 通过 `getAccounts` 读取账号。
  - 根据搜索词、issuer/label、账号顺序渲染账号卡片。
  - 账号卡片展示 issuer、label、autofill 域名规则、验证码、倒计时、HOTP next、QR 导出、编辑和删除按钮。
  - 验证码显示不在 popup 内直接生成，而是通过 `generateCodesForDisplay` 请求 background 生成。

- **账号新增、编辑、删除、排序**
  - 手动添加账号时，popup 只收集用户输入，将 secret、secretFormat、issuer、label、type、digits、period、counter、autofillPatterns 发给 background 的 `normalizeAccountForPopup`，由 background 标准化账号。
  - URI/migration 文本导入时，popup 调用 background 的 `parseAccountsForImport`，再在 popup 侧做重复账号提示和本地列表合并。
  - 编辑账号仅编辑 issuer、label、autofillPatterns。
  - 删除账号会更新账号列表并保存。
  - 支持桌面拖拽排序和移动端长按排序，排序结果保存在 `accountSettings.sequence`。

- **导入 / 导出**
  - 普通 `otpauth://` 文本导出通过 background 的 `buildOtpAuthUrisForExport` 生成。
  - JSON 明文导出通过 background 的 `buildJsonExportPayload` 生成。
  - 如果 vault 已启用加密，popup 会通过 `getEncryptedPayloadForExport` 获取加密 payload 状态，并询问用户是否导出加密 payload。
  - 粘贴导入文本时，popup 调用 `parseAccountsForImport`，然后做重复提示、合并账号并保存。
  - 独立 JSON 导入页通过打开 `json-import/json-import.html` 进入。

- **Vault、同步、权限、debug 设置 UI**
  - Vault 状态通过 `getVaultStatus` 获取；解锁、锁定、启用加密、关闭加密分别调用 background 的 vault action。
  - 自动锁设置通过 `getVaultTimerSettings` / `saveVaultTimerSettings` 管理。
  - Firefox Sync 设置通过 `getSyncSettings` / `saveSyncSettings` / `uploadSyncNow` / `downloadSyncToLocal` 管理。
  - autofill 与右键菜单开关通过 `getFeatureSettings` / `saveFeatureSettings` 管理。
  - debug 面板通过隐藏点击 logo 解锁，使用 `getDebugState`、`setDebugEnabled`、`getDebugLogText` 与 background 交互。

#### `popup/popup.html`

popup 页面结构。当前只加载：

- `../locales/i18n.js`
- `popup.js`

OTPAuth 和 Google migration 脚本不再由 popup 页面直接加载；相关解析已转移到 background。

---

### 2. `qr/`

#### `qr/qr.js`

二维码扫描页脚本，负责从图片中识别二维码 payload，并把 payload 交给 background 解析和保存。

主要职责：

- **本地化与主题**
  - 通过 `Vault2FALocales.getSection('qr-scanner', locale)` 加载当前语言。
  - 内置 `QR_FALLBACK` 作为英文 failsafe。
  - 支持根据系统颜色模式切换 light/dark。

- **图片来源处理**
  - 支持拖拽图片到页面。
  - 支持点击选择图片文件。
  - 支持右键菜单传入 `imageUrl`，页面会 fetch 图片资源后扫描。

- **二维码图像处理与解码**
  - 将图片转换为 `ImageData`。
  - 针对原图和多个缩放尺寸生成候选图像。
  - 使用 `window.jsQR` 逐个尝试识别二维码。
  - 对识别过程写入 debug 信息，包括图片尺寸、像素 hash、每次候选解码耗时等。

- **账号导入**
  - 扫描页不再直接使用 OTPAuth 解析账号。
  - 扫描得到的 raw payload 会通过 `addAccountsFromQrPayload` 发给 background。
  - background 返回导入账号列表和导入数量后，页面显示成功或错误状态。
  - 扫描成功后页面不会自动关闭。

- **debug 脱敏**
  - 对 otpauth secret 和 migration data 做预览脱敏，只记录有限长度的安全预览。

#### `qr/preview.js`

账号二维码导出预览页脚本。

主要职责：

- 从 URL hash 读取账号 id。
- 通过 `getOtpAuthUriForAccount` 向 background 请求该账号的 `otpauth://` URI。
- 使用 `third-party/qrcode.min.js` 在页面上生成二维码。
- 使用 `Vault2FALocales.getSection('qr-previewer', locale)` 加载文案。
- 内置 `PREVIEW_FALLBACK` 作为英文 failsafe。
- 生成失败或请求失败时显示错误面板并写 debug 信息。

#### `qr/qr.html`

二维码扫描页结构。当前加载：

- `../third-party/jsQR.js`
- `../locales/i18n.js`
- `qr.js`

OTPAuth 和 Google migration 不再由 QR 扫描页直接加载。

#### `qr/preview.html`

二维码导出预览页结构。加载：

- `../locales/i18n.js`
- `../third-party/qrcode.min.js`
- `preview.js`

---

### 3. `json-import/`

#### `json-import/json-import.js`

独立 JSON 导入页脚本。

主要职责：

- **本地化与主题**
  - 通过 `Vault2FALocales.getSection('json-import', locale)` 加载当前语言。
  - 内置 `JSON_IMPORT_FALLBACK` 作为英文 failsafe。
  - 支持系统 light/dark 主题。

- **文件选择与拖拽导入**
  - 支持拖拽 JSON 文件。
  - 支持点击选择 JSON 文件。
  - 对文件扩展名和 MIME 类型做基本判断。

- **导入处理**
  - 页面只读取文件文本，不再自行解析账号数组或加密 payload header。
  - 将 raw JSON 文本通过 `importAccountsFromJson` 发送给 background。
  - background 负责判断加密 payload、账号数组或 `{ accounts: [...] }` 结构，并执行保存。
  - 页面根据 background 响应显示普通账号导入或加密 payload 导入结果。

#### `json-import/json-import.html`

JSON 导入页结构。加载：

- `../locales/i18n.js`
- `json-import.js`

---

### 4. `background/`

#### `background/background.js`

background 入口和消息路由文件。

主要职责：

- 注册 `browser.runtime.onMessage`，根据 `message.action` 分发到各业务函数。
- 处理账号读写：`getAccounts`、`saveAccounts`。
- 处理同步设置与同步动作：`getSyncSettings`、`saveSyncSettings`、`uploadSyncNow`、`downloadSyncToLocal`。
- 处理功能开关：`getFeatureSettings`、`saveFeatureSettings`。
- 处理 QR 导出：`openQrPreviewForAccount`、`getOtpAuthUriForAccount`。
- 处理导出：`buildOtpAuthUrisForExport`、`buildJsonExportPayload`、`getEncryptedPayloadForExport`。
- 处理账号标准化和导入解析：`normalizeAccountForPopup`、`parseAccountsForImport`、`addAccountsFromQrPayload`、`addAccountFromQr`、`importAccountsFromJson`。
- 处理自动填充账号匹配和验证码生成：`getAccountsForAutofill`、`generateCodeForAutofillById`。
- 处理 popup 验证码显示：`generateCodesForDisplay`。
- 处理 debug：`getDebugState`、`setDebugEnabled`、`appendDebugInfo`、`getDebugLogText`。
- 处理 vault：`getVaultStatus`、`unlockVault`、`lockVault`、`enableEncryption`、`disableEncryption`、`getVaultTimerSettings`、`saveVaultTimerSettings`。
- 注册浏览器事件：tab 更新、installed/startup、context menu click、alarm、storage change。
- 启动时调度 sync auto upload、vault auto lock，并刷新 autofill 注入。

#### `background/storage-vault.js`

本地账号存储、vault 加密和自动锁相关逻辑。

主要职责：

- 定义本地账号、加密 payload、vault 设置的 storage key。
- 定义 vault 默认设置。
- 使用 PBKDF2-HMAC-SHA256 派生 AES-GCM 密钥。
- 加密 / 解密 JSON payload。
- 保存和恢复 session 解锁态到 `browser.storage.session`。
- `getLocalAccounts()`：未加密时读取明文账号；启用加密时要求 vault 已解锁并解密 payload。
- `setLocalAccounts()`：未加密时写明文账号；启用加密时重新加密后写入 `accountsEncrypted`。
- 启用加密、关闭加密、解锁、锁定、获取 vault 状态。
- 维护 vault 自动锁 alarm。
- 提供 encrypted payload header 识别、日志 header 提取和旧 payload 迁移判断。

#### `background/otp-account.js`

OTP、账号标准化、URI 构建和导入解析工具。

主要职责：

- 根据账号生成 TOTP/HOTP 当前验证码。
- 生成 popup 展示用验证码对象，包含 remaining、period、nextRefreshAt 等字段。
- 输入 secret 支持 base32、base64、hex、utf8、latin1，并在导入/新增阶段统一标准化为 Base32。
- 已存账号读取时按 Base32 处理。
- 构建 `otpauth://` URI。
- 标准化外部导入账号。
- 标准化已存账号用于 JSON 导出。
- 解析普通 `otpauth://` URI。
- 展开 Google Authenticator `otpauth-migration://` URI。
- 解析 JSON 导入文本和 URI 多行导入文本。

#### `background/sync.js`

Firefox Sync 同步逻辑。

主要职责：

- 保存和读取 sync 设置。
- 维护 sync session key。
- 根据 Firefox sync storage 限制估算大小并分片。
- 支持明文账号数组分片上传。
- 支持加密 payload 字符串分片上传。
- 下载 sync 数据并兼容当前 version 3、version 2 和旧结构。
- 下载时可应用到本地：普通账号会写入本地账号；加密 payload 会写入 encrypted storage、清空明文账号、锁定 vault 并启用加密状态。
- 维护自动上传 alarm。

#### `background/autofill-background.js`

自动填充后台能力和页面注入逻辑。

主要职责：

- 管理 `featureSettings`，包括 `autofillEnabled` 和 `rightclickEnabled`。
- 规范化 autofill 域名 pattern。
- 从账号读取 `autofillPatterns`，兼容旧字段 `domain`。
- 判断 hostname 是否匹配账号 pattern。
- 判断 URL 是否应跳过注入。
- 根据打开页面 hostname 判断是否有匹配账号。
- 动态注入 `autofill/autofill.css`、`locales/i18n.js`、`autofill/autofill-content.js`。
- 刷新所有打开 tab 的 autofill 注入。
- 对 autofill 相关 message 做 sender id 校验和功能开关校验。

#### `background/context-menu.js`

浏览器右键菜单逻辑。

主要职责：

- 定义图片右键菜单 id。
- 读取当前 UI 语言并加载 background section 的右键菜单标题。
- 内置 `BACKGROUND_FALLBACK` 作为标题 failsafe。
- 根据 `featureSettings.rightclickEnabled` 创建或移除右键菜单。
- 当用户在图片上点击右键菜单时，打开 `qr/qr.html?imageUrl=...`。

#### `background/qr-background.js`

账号 QR 导出后台协调逻辑。

主要职责：

- 根据账号 id 读取本地账号。
- 调用 `buildOtpAuthUriForAccount()` 生成 `otpauth://` URI。
- 写入 QR 导出 debug 信息。
- 打开 `qr/preview.html#id=...` 预览页。

#### `background/debug.js`

debug 设置、日志和脱敏工具。

主要职责：

- 保存和读取 debug 设置。
- 开关 debug enabled。
- 对 secret、otpauth URI、嵌套对象中的 secret/data 字段做脱敏。
- 将 debug 日志追加到 `browser.storage.local`。
- 导出 debug 日志文本。
- debug 关闭时不会写日志。

---

### 5. `autofill/`

#### `autofill/autofill-content.js`

注入到网页中的自动填充 content script。

主要职责：

- 避免重复注入。
- 加载主题和当前语言的 autofill section。
- 内置 `AUTOFILL_FALLBACK` 作为英文 failsafe。
- 判断当前 focus 的 input 是否像 OTP/2FA 输入框。
- 向 background 请求当前 hostname 匹配的账号列表。
- 如果 vault 锁定，显示锁定提示。
- 渲染账号候选 dropdown，展示 issuer、label、当前验证码和 HOTP 信息。
- 用户点击候选账号后，通过 `generateCodeForAutofillById` 向 background 请求验证码，并写入当前 input。
- 写入 input 时使用原生 value setter，并触发 input/change/keyup 事件。

#### `autofill/autofill.css`

自动填充 dropdown 的样式文件，由 background 动态注入。

---

### 6. `migration/`

#### `migration/google.js`

Google Authenticator migration URI 解码工具。

主要职责：

- 判断是否为 `otpauth-migration://` URI。
- 解码 base64url payload。
- 解析 Google migration protobuf-like 数据结构。
- 将 migration 中的账号条目转换为内部中间对象。
- 将中间对象构建为标准 `otpauth://` URI。
- 以 `window.Vault2FAGoogleMigration` 暴露给 background 使用。

---

### 7. `locales/`

#### `locales/i18n.js`

集中本地化加载工具。

主要职责：

- 解析 `.lang` 文件文本。
- 读取 `locales/lang.conf` 获取可用 locale id。
- 规范化语言 id。
- 根据 `browser.storage.local.uiLanguage` 或浏览器 UI language 决定默认语言。
- `getSection(sectionName, language)`：检查语言是否在 `lang.conf` 中，加载对应单个 `.lang` 文件并返回指定 section。
- `getAvailableLanguages()`：读取 `lang.conf` 中所有语言文件的 `[Information]` 和 `[Language]` section，用于 popup 语言列表显示语言名、翻译者和语言文件版本。
- 提供缓存，避免同一 locale 文件重复 fetch。

#### `locales/*.lang`

各语言文本文件。

主要 section：

- `[Information]`：翻译者、语言文件版本等元信息。
- `[Language]`：语言显示名和 locale id。
- `[popup]`：popup 页面文案。
- `[qr-scanner]`：二维码扫描页文案。
- `[qr-previewer]`：二维码预览页文案。
- `[json-import]`：JSON 导入页文案。
- `[autofill]`：自动填充 dropdown 文案。
- `[background]`：后台 UI 文案，目前用于右键菜单标题。

---

## 二、按操作划分的业务逻辑

### 1. 插件启动与后台初始化

1. `manifest.json` 依次加载 OTPAuth、本地化工具、debug、storage-vault、migration、OTP account、QR、sync、autofill、context-menu 和 background 入口脚本。
2. `background/background.js` 注册 runtime message handler。
3. 注册 tab update、installed、startup、context menu、alarm、storage change 等监听。
4. 启动时执行：
   - `ensureSyncAutoUploadAlarm()`。
   - `scheduleVaultAutoLock()`。
   - `refreshAutofillInjectionForOpenTabs()`。

### 2. Popup 打开与账号展示

1. popup 启动时读取 `uiLanguage`、`uiTheme`。
2. 调用 `Vault2FALocales.getAvailableLanguages()` 获取语言列表 metadata。
3. 加载当前语言 popup section，并应用主题与静态文案。
4. 调用 `getVaultStatus` 获取 vault 状态。
5. 如果 vault 已加密且未解锁，显示锁屏，不加载账号。
6. 如果可读取账号，调用 `getAccounts` 从 background 获取账号列表。
7. 加载账号排序设置并迁移缺失 sequence。
8. 渲染账号卡片，并调用 `generateCodesForDisplay` 生成当前展示验证码。
9. ticker 周期性刷新显示剩余秒数和即将过期的验证码。

### 3. 手动添加账号

1. 用户在 popup 手动输入 issuer、label、secret、secretFormat、type、digits、period、autofillPatterns。
2. popup 做基本空值校验。
3. popup 调用 `normalizeAccountForPopup`。
4. background 使用 `normalizeImportedAccountRecord()`：
   - 按 secretFormat 解析输入 secret。
   - 将 secret 标准化为 Base32。
   - 生成 id。
   - 标准化 type、issuer、label、algorithm、digits、period、counter、autofillPatterns。
5. popup 检查潜在重复账号并询问用户。
6. popup 将账号加入本地数组，调用 `saveAccounts`。
7. background 通过 `setLocalAccounts()` 保存：未加密写明文；加密时写入加密 payload。

### 4. URI / migration 文本导入

1. 用户在 popup 粘贴 URI 文本。
2. popup 调用 `parseAccountsForImport`。
3. background 使用 `parseAccountsForImportData()` 判断输入：
   - JSON 文本走 JSON 账号解析。
   - 非 JSON 文本按多行 URI 解析。
4. 对每一行 URI：
   - 普通 `otpauth://` 使用 OTPAuth 解析。
   - `otpauth-migration://` 通过 `Vault2FAGoogleMigration` 展开为一个或多个 `otpauth://` URI。
5. background 返回标准化账号列表和失败数量。
6. popup 处理重复提示、合并账号、保存账号并显示导入摘要。

### 5. QR 图片扫描导入

1. 用户打开 QR 扫描页，可以通过：
   - popup 的打开 QR 页面按钮。
   - 右键菜单扫描网页图片。
   - 手动拖拽或选择图片。
2. `qr/qr.js` 将图片转换为 `ImageData`。
3. 生成原图和缩放候选图像。
4. 使用 `jsQR` 解码二维码文本。
5. 解码成功后，页面调用 `addAccountsFromQrPayload` 并发送 raw payload。
6. background 使用 `parseAccountsForImportData()` 解析普通 otpauth 或 migration payload。
7. background 将解析出的账号合并到本地账号并保存。
8. QR 页面显示导入成功的账号名或 migration 导入摘要。

### 6. JSON 文件导入

1. 用户在 JSON 导入页拖拽或选择 JSON 文件。
2. 页面检查文件类型，然后读取文本。
3. 页面调用 `importAccountsFromJson` 并传 raw JSON 文本。
4. background 解析 JSON：
   - 如果是加密 payload header 且含 data，则写入 encrypted payload，清空明文账号，锁定 vault，并启用加密状态。
   - 否则识别账号数组或 `{ accounts: [...] }`。
5. 普通账号导入时，background 使用 `normalizeImportedAccountRecord()` 标准化并合并账号。
6. 页面根据 response 显示普通导入成功或加密数据导入成功。

### 7. OTP 验证码生成

1. popup 展示验证码时调用 `generateCodesForDisplay`。
2. background 根据请求 ids 从本地账号中查找对应账号。
3. 对每个账号调用 `buildDisplayCodeInfo()`。
4. `buildDisplayCodeInfo()` 内部调用 `buildAutofillCodeInfo()`：
   - 已存 secret 按 Base32 读取。
   - HOTP 使用 counter 生成验证码。
   - TOTP 使用 period 生成验证码，并计算剩余时间。
5. 返回 code、remaining、period、counter、type、digits、nextRefreshAt 等给 popup。

### 8. 自动填充验证码

1. background 根据账号 autofillPatterns 和当前 tab hostname 判断是否需要注入 autofill 资源。
2. 注入内容包括 CSS、本地化工具和 `autofill-content.js`。
3. content script 监听 focus，判断 input 是否像 OTP 输入框。
4. 命中时调用 `getAccountsForAutofill`。
5. background：
   - 如果 vault 锁定，返回 locked。
   - 否则筛选 hostname 匹配的账号。
   - 为每个账号生成当前验证码和剩余时间。
6. content script 渲染 dropdown。
7. 用户点击账号后，content script 调用 `generateCodeForAutofillById`。
8. background 再次校验 hostname 与账号 pattern，生成验证码返回。
9. content script 写入 input 并派发 input/change/keyup 事件。

### 9. 账号 QR 导出

1. 用户在 popup 点击账号卡片的 QR 导出按钮。
2. popup 调用 `openQrPreviewForAccount`。
3. background 打开 `qr/preview.html#id=...`。
4. 预览页读取 hash 中的账号 id。
5. 预览页调用 `getOtpAuthUriForAccount`。
6. background 根据账号 id 查找账号，并调用 `buildOtpAuthUriForAccount()` 生成 `otpauth://` URI。
7. 预览页使用 `QRCode` 库生成二维码。

### 10. 文本 URI 导出

1. 用户在 popup 点击普通导出按钮。
2. popup 调用 `buildOtpAuthUrisForExport`。
3. background 读取本地账号。
4. 对每个账号调用 `buildOtpAuthUriForAccount()`。
5. 返回 URI 列表。
6. popup 将 URI 逐行显示在导出 textarea 中，用户可复制。

### 11. JSON 导出

1. 用户在 popup 点击 JSON 导出按钮。
2. popup 先调用 `buildJsonExportPayload` 获取明文导出 payload。
3. background 读取本地账号，并使用 `normalizeStoredAccountRecord()` 标准化已存账号。
4. 如果 vault 已启用加密，popup 再调用 `getEncryptedPayloadForExport`。
5. 如果存在加密 payload，popup 询问是否导出加密版本。
6. popup 根据用户选择生成下载 Blob 并触发下载。

### 12. Vault 加密、解锁和自动锁

1. 启用加密时，background 根据 passphrase 和 salt 派生 AES-GCM key。
2. 当前明文账号被加密成 payload 并写入 `accountsEncrypted`。
3. 明文账号被清空，vault 设置标记为启用加密。
4. 解锁时，background 解密 payload 验证 passphrase，并将解锁态保存到 session storage。
5. 锁定时，background 清空内存和 session 中的解锁态。
6. 自动锁开启时，background 根据 `autoLockMinutes` 创建 alarm。
7. 每次账号读取/保存等活动会调用 `touchVaultActivity()` 更新最后解锁时间并重新调度自动锁。

### 13. Firefox Sync 上传与下载

1. 用户配置 sync session id、启用状态、上传间隔和是否上传加密 payload。
2. 手动或自动上传时，background 调用 `uploadToSync()`。
3. 如果上传明文账号，按账号数组分片写入 `browser.storage.sync`。
4. 如果上传加密 payload，则将 payload JSON 字符串分片写入 sync。
5. 下载时，background 读取 sync metadata 和 chunk。
6. 支持 version 3、version 2 和旧格式。
7. 如果下载普通账号并 apply，则覆盖本地账号。
8. 如果下载加密 payload 并允许 encrypted，则写入 encrypted payload，清空明文账号，并将 vault 置为加密锁定状态。

### 14. 右键菜单扫描网页图片

1. background 根据 feature settings 创建图片右键菜单。
2. 菜单标题通过 `background` locale section 加载，失败时使用 `BACKGROUND_FALLBACK`。
3. 用户在网页图片上点击菜单后，background 打开 `qr/qr.html?imageUrl=...`。
4. QR 页面 fetch 该图片并走 QR 扫描导入流程。

### 15. Debug 日志

1. debug 默认关闭。
2. popup 隐藏点击 logo 后显示 debug UI。
3. 开启 debug 后，各模块通过 `appendDebugInfo` 写日志。
4. 写入前会对 secret、otpauth URI、migration data、嵌套字段做脱敏。
5. popup 可以通过 `getDebugLogText` 导出当前日志文本。

### 16. 本地化加载

1. 页面先加载 `locales/i18n.js`。
2. `i18n.js` 读取 `lang.conf` 获取可用语言。
3. 页面调用 `getSection(section, locale)` 加载指定 section。
4. 如果指定语言存在于 `lang.conf`，则加载该语言文件。
5. 如果语言不存在、文件加载失败或 key 缺失，页面使用自身内置的英文 fallback 常量。
6. popup 语言列表使用 `getAvailableLanguages()`，该函数会读取所有语言文件的 `[Information]` 和 `[Language]` section，以显示语言名、翻译者和版本，并支持语言文件版本与插件版本比对。
