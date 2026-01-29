# 系统设置功能说明

## 概述

系统设置页面允许管理员配置账号池系统的运行参数，包括维护间隔、环境变量状态查看等。

## 访问路径

- **URL**: `http://localhost:3000/admin/pool/settings`
- **导航**: 管理后台侧边栏 → 系统设置

## 功能说明

### 1. 维护设置

#### 自动维护间隔
- **配置项**: 维护间隔（分钟）
- **默认值**: 15 分钟
- **取值范围**: 1-1440 分钟
- **说明**: 系统将按照设定的间隔自动对账号池进行维护检查，包括账号健康检查、Cookie 有效性验证等
- **建议值**: 15-60 分钟

#### 上次维护时间
- **类型**: 只读显示
- **说明**: 显示最近一次自动维护的执行时间

### 2. 环境变量配置状态

系统会自动检测关键环境变量的配置状态，这些变量需要在项目根目录的 `.env` 文件中配置。

#### TWOCAPTCHA_KEY
- **用途**: 2Captcha 验证码服务密钥
- **必需性**: 可选（但强烈建议配置）
- **获取方式**: 访问 [2captcha.com](https://2captcha.com) 注册并获取 API 密钥
- **配置示例**: 
  ```env
  TWOCAPTCHA_KEY=your_api_key_here
  ```
- **说明**: 用于自动解决 Suno 登录时的 hCaptcha 验证码

#### ADMIN_PASSWORD
- **用途**: 管理后台登录密码
- **默认值**: `admin123`
- **必需性**: 可选（建议修改）
- **配置示例**:
  ```env
  ADMIN_PASSWORD=your_secure_password
  ```
- **说明**: 用于保护管理后台的访问安全

## API 接口

### 获取系统设置
```http
GET /api/pool/settings
Authorization: Basic base64(super:password)
```

**响应示例**:
```json
{
  "success": true,
  "settings": {
    "maintenanceIntervalMinutes": 15,
    "lastMaintenanceTime": 1769693858640,
    "twocaptchaKeyConfigured": true,
    "twocaptchaKey": "***1234",
    "adminPasswordConfigured": true
  }
}
```

### 更新系统设置
```http
PUT /api/pool/settings
Authorization: Basic base64(super:password)
Content-Type: application/json

{
  "maintenanceIntervalMinutes": 30
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "系统设置更新成功"
}
```

## 数据存储

系统设置存储在 SQLite 数据库的 `system_config` 表中：

| 字段 | 类型 | 说明 |
|------|------|------|
| key | TEXT | 配置键名（主键） |
| value | TEXT | 配置值 |
| updated_at | INTEGER | 更新时间戳 |

### 配置键说明

- `maintenance_interval_minutes`: 维护间隔（分钟）
- `last_maintenance_time`: 上次维护时间戳

## 注意事项

1. **环境变量修改**: 修改 `.env` 文件中的环境变量后，需要重启服务才能生效
2. **权限要求**: 访问系统设置页面需要管理员身份验证
3. **维护间隔**: 建议根据账号数量和使用频率调整维护间隔，账号越多建议间隔越短
4. **安全性**: 生产环境务必修改默认的 `ADMIN_PASSWORD`

## 使用流程

1. 登录管理后台（`/admin/pool/login`）
2. 点击侧边栏的"系统设置"菜单
3. 修改维护间隔等参数
4. 点击"保存设置"按钮
5. 系统会自动应用新的配置

## 故障排查

### 问题：保存设置失败
- **原因**: 可能是权限验证失败或数据库写入错误
- **解决**: 检查是否正确登录，查看浏览器控制台和服务器日志

### 问题：环境变量显示未配置
- **原因**: `.env` 文件中未设置对应的环境变量
- **解决**: 在项目根目录的 `.env` 文件中添加相应配置，然后重启服务

### 问题：修改维护间隔后未生效
- **原因**: 配置已保存，但需要等待下一次维护周期
- **解决**: 可以在仪表盘页面点击"立即维护"按钮手动触发维护
