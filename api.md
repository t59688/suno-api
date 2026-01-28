## Suno API 文档：`/api/get_limit` 与 `/api/custom_generate`

- `GET /api/get_limit`：获取当前账号配额信息  
- `POST /api/custom_generate`：自定义模式生成音乐  

所有接口通过 HTTP 请求头 `Cookie` 携带 Suno 会话 Cookie，例如：

```http
Cookie: __client=...; __client_uat=...; ...
```

本文件不关心 Cookie 的获取方式，只规定其在请求中的使用方式。

---

## `GET /api/get_limit`

- **方法**：`GET`  
- **路径**：`/api/get_limit`  
- **请求头**：
  - `Cookie: <Suno 会话 Cookie>`

### 请求示例（curl）

```bash
curl -X GET "https://your-domain.com/api/get_limit" \
  -H "Cookie: __client=xxxx; __client_uat=xxxx; ..."
```

### 成功响应（200）

```json
{
  "credits_left": 10,
  "period": "2025-11-01/2025-12-01",
  "monthly_limit": 250,
  "monthly_usage": 240
}
```

- `credits_left`：剩余积分  
- `period`：当前计费周期  
- `monthly_limit`：当前周期配额上限  
- `monthly_usage`：当前周期已使用配额  

### 错误响应

- `500 Internal Server Error`：内部错误或上游 Suno 接口异常。

---

## `POST /api/custom_generate`

- **方法**：`POST`  
- **路径**：`/api/custom_generate`  
- **请求头**：
  - `Content-Type: application/json`
  - `Cookie: <Suno 会话 Cookie>`

### 请求体（JSON）

```json
{
  "prompt": "string",
  "tags": "string",
  "title": "string",
  "make_instrumental": false,
  "model": "chirp-crow",
  "wait_audio": true,
  "negative_tags": "string"
}
```

- `prompt` `string`，必填：自定义歌词或描述文本。  
- `tags` `string`，必填：音乐风格标签，逗号分隔。  
- `title` `string`，必填：歌曲标题。  
- `make_instrumental` `boolean`，可选，默认 `false`：是否生成纯伴奏。  
- `model` `string`，可选：模型名称，留空使用默认模型。  
- `wait_audio` `boolean`，可选，默认 `false`：是否等待音频生成完成后再返回。  
- `negative_tags` `string`，可选：需要避免的风格标签。  

### 请求示例（curl）

```bash
curl -X POST "https://your-domain.com/api/custom_generate" \
  -H "Content-Type: application/json" \
  -H "Cookie: __client=xxxx; __client_uat=xxxx; ..." \
  -d '{
    "prompt": "[Verse]\nCoding all night long\n[Chorus]\nBugs are everywhere",
    "tags": "indie rock, energetic, electric guitar",
    "title": "Developer Blues",
    "make_instrumental": false,
    "model": "chirp-crow",
    "wait_audio": true,
    "negative_tags": "slow, acoustic"
  }'
```

### 成功响应（200）

返回数组，每个元素为一个音频对象 `AudioInfo`：

```json
[
  {
    "id": "string",
    "title": "string",
    "image_url": "string",
    "lyric": "string",
    "audio_url": "string",
    "video_url": "string",
    "created_at": "string",
    "model_name": "string",
    "status": "submitted | queued | streaming | complete | error",
    "tags": "string",
    "negative_tags": "string",
    "duration": "string"
  }
]
```

字段说明：

- `id`：音频 ID  
- `title`：标题  
- `image_url`：封面图 URL  
- `lyric`：歌词文本  
- `audio_url`：音频文件 URL（`wait_audio=true` 且状态为 `streaming/complete` 时通常可用）  
- `video_url`：视频 URL（如有）  
- `created_at`：创建时间  
- `model_name`：使用的模型名称  
- `status`：生成状态  
- `tags`：风格标签  
- `negative_tags`：负面标签  
- `duration`：时长信息  

### 错误响应

- `400 Bad Request`：请求体缺少必填字段或字段类型错误。  
- `401 Unauthorized` / `403 Forbidden`：`Cookie` 无效或会话无权限。  
- `500 Internal Server Error`：内部错误或上游 Suno 接口异常。

